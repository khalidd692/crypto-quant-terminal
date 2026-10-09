export interface NormalizedKucoinTicker {
  lastPrice: number;
  bestBidPrice: number;
  bestAskPrice: number;
  quoteVolume: number;
  priceChangePercent: number;
  high: number;
  low: number;
}
export interface NormalizedKucoinTickerResponse {
  data: { list: NormalizedKucoinTicker[] };
}

/** Normalize KuCoin's public /api/v1/market/stats payload to the ticker shape used by surveillance. */
export function normalizeKucoinStatsResponse(value: unknown): NormalizedKucoinTickerResponse {
  if (!value || typeof value !== "object" || !("data" in value)) {
    throw new Error("KUCOIN_STATS_SCHEMA_INVALID: missing data object");
  }
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    throw new Error("KUCOIN_STATS_SCHEMA_INVALID: data is not an object");
  }
  const row = data as Record<string, unknown>;
  const lastPrice = Number(row.last);
  const bestBidPrice = Number(row.buy);
  const bestAskPrice = Number(row.sell);
  const quoteVolume = Number(row.volValue);
  const changeRate = Number(row.changeRate);
  const high = Number(row.high);
  const low = Number(row.low);
  const values = [lastPrice, bestBidPrice, bestAskPrice, quoteVolume, changeRate, high, low];
  if (!values.every(Number.isFinite) || lastPrice <= 0 || bestBidPrice <= 0 || bestAskPrice < bestBidPrice || quoteVolume <= 0 || high < low || low <= 0) {
    throw new Error("KUCOIN_STATS_SCHEMA_INVALID: required market values missing or incoherent");
  }
  return {
    data: {
      list: [{
        lastPrice,
        bestBidPrice,
        bestAskPrice,
        quoteVolume,
        priceChangePercent: changeRate * 100,
        high,
        low
      }]
    }
  };
}
