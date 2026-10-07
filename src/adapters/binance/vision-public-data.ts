import { unzipSync, strFromU8 } from "fflate";
import type { MarketDataPoint } from "../../domain/types.js";
import type { BinanceFundingRate } from "./public-client.js";

const BASE = "https://data.binance.vision/data/futures/um/monthly";

function monthKeys(startTimeMs: number, endTimeMs: number): string[] {
  const start = new Date(startTimeMs);
  const end = new Date(endTimeMs);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const result: string[] = [];
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

async function downloadCsv(url: string, fetchImpl: typeof fetch): Promise<{ readonly url: string; readonly csv: string }> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error("Binance Vision HTTP " + response.status + " for " + url);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const entries = Object.entries(archive);
  const csv = entries.find(([name]) => name.toLowerCase().endsWith(".csv"))?.[1];
  if (!csv) throw new Error("Binance Vision archive has no CSV: " + url);
  return { url, csv: strFromU8(csv) };
}

function fields(line: string): string[] {
  return line.split(",").map((value) => value.trim());
}

function number(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid " + name + ": " + value);
  return parsed;
}

export class BinanceVisionHistoricalClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
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
      const { csv } = await downloadCsv(url, this.fetchImpl);
      const lines = csv.split(/?
/).filter(Boolean);
      for (const line of lines) {
        const row = fields(line);
        if (row[0] === "open_time") continue;
        if (row.length < 7) continue;
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
      const { csv } = await downloadCsv(url, this.fetchImpl);
      const lines = csv.split(/?
/).filter(Boolean);
      for (const line of lines) {
        const row = fields(line);
        if (row[0] === "calc_time" || row[0] === "fundingTime") continue;
        if (row.length < 3) continue;
        const fundingTime = number(row[0], "fundingTime");
        if (fundingTime < startTimeMs || fundingTime >= endTimeMs) continue;
        rates.set(String(fundingTime), {
          symbol,
          fundingRate: number(row[2], "fundingRate"),
          fundingTime: new Date(fundingTime).toISOString(),
          markPrice: null,
          rateType: "binance-vision-fundingRate",
        });
      }
    }
    return [...rates.values()].sort((a, b) => a.fundingTime.localeCompare(b.fundingTime));
  }
}
