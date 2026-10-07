import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import type { MarketDataPoint } from "../../domain/types.js";
import type { BinanceFundingRate } from "./public-client.js";

const BASE = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision/data/futures/um/monthly";

function monthKeys(startTimeMs: number, endTimeMs: number): string[] {
  const start = new Date(startTimeMs);
  const end = new Date(endTimeMs);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const result: string[] = [];
  while (cursor.getTime() < endTimeMs) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

async function downloadCsv(url: string, fetchImpl: typeof fetch): Promise<string> {
  let fetchError: unknown = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Binance Vision HTTP " + response.status + " for " + url);
      const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
      const csv = Object.entries(archive).find(([name]) => name.toLowerCase().endsWith(".csv"))?.[1];
      if (!csv) throw new Error("Binance Vision archive has no CSV: " + url);
      return strFromU8(csv);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    fetchError = error;
  }

  try {
    const { stdout } = await execFileAsync("curl", [
      "--fail", "--location", "--silent", "--show-error",
      "--retry", "3", "--retry-delay", "2", "--connect-timeout", "10", "--max-time", "60",
      url,
    ], { maxBuffer: 64 * 1024 * 1024 });
    const archive = unzipSync(new Uint8Array(Buffer.from(stdout, "binary")));
    const csv = Object.entries(archive).find(([name]) => name.toLowerCase().endsWith(".csv"))?.[1];
    if (!csv) throw new Error("Binance Vision archive has no CSV: " + url);
    return strFromU8(csv);
  } catch (curlError) {
    throw new Error("Binance Vision download failed via fetch and curl: " + String(fetchError) + "; " + String(curlError));
  }
}

function rows(csv: string): string[][] {
  return csv
    .split(String.fromCharCode(10))
    .map((line) => line.replace(String.fromCharCode(13), "").trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((value) => value.trim()));
}

function number(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid " + name + ": " + value);
  return parsed;
}

export class BinanceVisionHistoricalClient {
  private readonly fetchImpl: typeof fetch;
  private readonly fundingArchiveDir: string | undefined;

  public constructor(fetchImpl: typeof fetch = fetch, fundingArchiveDir?: string) {
    this.fetchImpl = fetchImpl;
    this.fundingArchiveDir = fundingArchiveDir;
  }

  public async historicalKlines(
    symbol: string,
    interval: string,
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<MarketDataPoint[]> {
    const points = new Map<string, MarketDataPoint>();
    for (const month of monthKeys(startTimeMs, endTimeMs)) {
      const url = BASE + "/klines/" + symbol + "/" + interval + "/" + symbol + "-" + interval + "-" + month + ".zip";
      const csv = await downloadCsv(url, this.fetchImpl);
      for (const row of rows(csv)) {
        if (row[0] === "open_time" || row.length < 7) continue;
        const openTime = number(row[0], "openTime");
        const closeTime = number(row[6], "closeTime");
        if (closeTime < startTimeMs || closeTime >= endTimeMs) continue;
        const eventTime = new Date(closeTime).toISOString();
        points.set(eventTime, {
          instrumentId: symbol,
          eventTime: eventTime as MarketDataPoint["eventTime"],
          availableTime: eventTime as MarketDataPoint["availableTime"],
          open: number(row[1], "open"),
          high: number(row[2], "high"),
          low: number(row[3], "low"),
          close: number(row[4], "close"),
          volume: number(row[5], "volume"),
          dataQuality: "complete",
          sourceId: url + "#" + openTime,
        });
      }
    }
    return [...points.values()].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  }

  public async historicalFundingRates(
    symbol: string,
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<BinanceFundingRate[]> {
    const rates = new Map<string, BinanceFundingRate>();
    for (const month of monthKeys(startTimeMs, endTimeMs)) {
      const url = BASE + "/fundingRate/" + symbol + "/" + symbol + "-fundingRate-" + month + ".zip";
      const archive = this.fundingArchiveDir
        ? unzipSync(new Uint8Array(readFileSync(join(this.fundingArchiveDir, symbol + "-fundingRate-" + month + ".zip"))))
        : await (async () => {
            const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
            if (!response.ok) throw new Error("Binance Vision HTTP " + response.status + " for " + url);
            return unzipSync(new Uint8Array(await response.arrayBuffer()));
          })();
      const csv = Object.entries(archive).find(([name]) => name.toLowerCase().endsWith(".csv"))?.[1];
      if (!csv) throw new Error("Binance Vision archive has no CSV: " + url);
      for (const row of rows(strFromU8(csv))) {
        if (row[0] === "calc_time" || row[0] === "fundingTime" || row.length < 3) continue;
        const fundingTime = number(row[0], "fundingTime");
        if (fundingTime < startTimeMs || fundingTime >= endTimeMs) continue;
        rates.set(String(fundingTime), {
          symbol,
          fundingRate: number(row[2], "fundingRate"),
          fundingTime: new Date(fundingTime).toISOString() as BinanceFundingRate["fundingTime"],
          markPrice: null,
          rateType: "binance-vision-fundingRate",
        });
      }
    }
    return [...rates.values()].sort((a, b) => a.fundingTime.localeCompare(b.fundingTime));
  }
}
