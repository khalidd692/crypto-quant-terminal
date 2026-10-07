import type { MarketDataPoint, ISO8601 } from "../../domain/types.js";

export type BinanceMarket = "spot" | "usdm-futures";

export interface BinanceClientOptions {
  readonly market: BinanceMarket;
  readonly timeoutMs?: number;
  readonly availabilityLagMs?: number;
  readonly fetchImpl?: typeof fetch;
}

export interface BinanceBookTicker {
  readonly symbol: string;
  readonly bidPrice: number;
  readonly bidQty: number;
  readonly askPrice: number;
  readonly askQty: number;
  readonly eventTime: ISO8601;
}

export interface BinanceFuturesContext {
  readonly symbol: string;
  readonly fundingRate: number | null;
  readonly openInterest: number | null;
  readonly eventTime: ISO8601 | null;
}

const SPOT_BASE = "https://data-api.binance.vision";
const FUTURES_BASE = "https://fapi.binance.com";

function iso(ms: number): ISO8601 {
  return new Date(ms).toISOString() as ISO8601;
}

function finiteNumber(value: unknown, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}: ${String(value)}`);
  return parsed;
}

async function requestJson<T>(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Binance HTTP ${response.status} for ${url}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function endpoint(market: BinanceMarket): string {
  return market === "spot" ? SPOT_BASE : FUTURES_BASE;
}

export class BinancePublicClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly availabilityLagMs: number;

  public constructor(options: BinanceClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = endpoint(options.market);
    this.availabilityLagMs = options.availabilityLagMs ?? 0;
  }

  public async klines(symbol: string, interval: string, limit = 200): Promise<MarketDataPoint[]> {
    if (!/^[A-Z0-9_]+$/.test(symbol)) throw new Error("Symbol must be uppercase alphanumeric");
    if (limit < 1 || limit > 1000) throw new Error("limit must be between 1 and 1000");

    const url = new URL(this.baseUrl + (this.baseUrl.includes("fapi") ? "/fapi/v1/klines" : "/api/v3/klines"));
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(limit));

    const receivedAt = Date.now();
    const rows = await requestJson<unknown[]>(url.toString(), this.timeoutMs, this.fetchImpl);
    return rows.filter((row) => Array.isArray(row) && Number(row[6]) <= receivedAt).map((row, index) => {
      if (!Array.isArray(row) || row.length < 7) throw new Error(`Invalid kline row at index ${index}`);
      const openTime = finiteNumber(row[0], "openTime");
      const closeTime = finiteNumber(row[6], "closeTime");
      const availableTime = closeTime + this.availabilityLagMs;
      return {
        instrumentId: symbol,
        eventTime: iso(closeTime),
        availableTime: iso(availableTime),
        open: finiteNumber(row[1], "open"),
        high: finiteNumber(row[2], "high"),
        low: finiteNumber(row[3], "low"),
        close: finiteNumber(row[4], "close"),
        volume: finiteNumber(row[5], "volume"),
        dataQuality: "complete",
        sourceId: `binance:${this.baseUrl}:klines:${symbol}:${interval}:${openTime}`,
      };
    });
  }

  public async historicalKlines(
    symbol: string,
    interval: string,
    startTimeMs: number,
    endTimeMs: number,
    options: { readonly pageDelayMs?: number; readonly maxPages?: number } = {},
  ): Promise<MarketDataPoint[]> {
    if (!Number.isInteger(startTimeMs) || !Number.isInteger(endTimeMs) || startTimeMs >= endTimeMs) {
      throw new Error("Invalid historical time range");
    }
    const pageDelayMs = options.pageDelayMs ?? 200;
    const maxPages = options.maxPages ?? 1000;
    if (pageDelayMs < 0 || maxPages <= 0) throw new Error("Invalid pagination configuration");

    const results = new Map<string, MarketDataPoint>();
    let cursor = startTimeMs;
    let pages = 0;
    while (cursor < endTimeMs) {
      if (pages >= maxPages) throw new Error("Historical pagination exceeded maxPages");
      const url = new URL(this.baseUrl + (this.baseUrl.includes("fapi") ? "/fapi/v1/klines" : "/api/v3/klines"));
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("interval", interval);
      url.searchParams.set("startTime", String(cursor));
      url.searchParams.set("endTime", String(endTimeMs));
      url.searchParams.set("limit", "1000");

      const receivedAt = Date.now();
      const rows = await requestJson<unknown[]>(url.toString(), this.timeoutMs, this.fetchImpl);
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 7) throw new Error("Invalid historical kline row");
        const openTime = finiteNumber(row[0], "openTime");
        const closeTime = finiteNumber(row[6], "closeTime");
        if (closeTime > receivedAt || closeTime < startTimeMs || openTime > endTimeMs) continue;
        const point: MarketDataPoint = {
          instrumentId: symbol,
          eventTime: iso(closeTime),
          availableTime: iso(closeTime + this.availabilityLagMs),
          open: finiteNumber(row[1], "open"),
          high: finiteNumber(row[2], "high"),
          low: finiteNumber(row[3], "low"),
          close: finiteNumber(row[4], "close"),
          volume: finiteNumber(row[5], "volume"),
          dataQuality: "complete",
          sourceId: `binance:${this.baseUrl}:klines:${symbol}:${interval}:${openTime}`,
        };
        results.set(point.eventTime, point);
      }

      const last = rows.at(-1);
      if (!Array.isArray(last)) break;
      const lastOpen = finiteNumber(last[0], "lastOpenTime");
      const nextCursor = lastOpen + 1;
      if (nextCursor <= cursor) throw new Error("Historical pagination cursor did not advance");
      cursor = nextCursor;
      pages += 1;
      if (rows.length < 1000) break;
      if (pageDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
    }

    return [...results.values()].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  }

  public async bookTicker(symbol: string): Promise<BinanceBookTicker> {
    const path = this.baseUrl.includes("fapi") ? "/fapi/v1/ticker/bookTicker" : "/api/v3/ticker/bookTicker";
    const url = new URL(this.baseUrl + path);
    url.searchParams.set("symbol", symbol);
    const row = await requestJson<Record<string, unknown>>(url.toString(), this.timeoutMs, this.fetchImpl);
    const eventMs = Date.now();
    return {
      symbol,
      bidPrice: finiteNumber(row.bidPrice, "bidPrice"),
      bidQty: finiteNumber(row.bidQty, "bidQty"),
      askPrice: finiteNumber(row.askPrice, "askPrice"),
      askQty: finiteNumber(row.askQty, "askQty"),
      eventTime: iso(eventMs),
    };
  }

  public async futuresContext(symbol: string): Promise<BinanceFuturesContext> {
    if (!this.baseUrl.includes("fapi")) throw new Error("Futures context requires the USDⓈ-M futures client");

    const oiUrl = new URL(this.baseUrl + "/fapi/v1/openInterest");
    oiUrl.searchParams.set("symbol", symbol);
    const fundingUrl = new URL(this.baseUrl + "/fapi/v1/fundingRate");
    fundingUrl.searchParams.set("symbol", symbol);
    fundingUrl.searchParams.set("limit", "1");

    const [oi, funding] = await Promise.all([
      requestJson<Record<string, unknown>>(oiUrl.toString(), this.timeoutMs, this.fetchImpl),
      requestJson<unknown[]>(fundingUrl.toString(), this.timeoutMs, this.fetchImpl),
    ]);

    const fundingRow = Array.isArray(funding) && funding.length > 0 && typeof funding[0] === "object" && funding[0] !== null
      ? funding[0] as Record<string, unknown>
      : null;

    return {
      symbol,
      openInterest: oi.openInterest === undefined ? null : finiteNumber(oi.openInterest, "openInterest"),
      fundingRate: fundingRow?.fundingRate === undefined ? null : finiteNumber(fundingRow.fundingRate, "fundingRate"),
      eventTime: fundingRow?.fundingTime === undefined ? null : iso(finiteNumber(fundingRow.fundingTime, "fundingTime")),
    };
  }
}
