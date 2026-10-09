import assert from "node:assert/strict";
import { normalizeKucoinStatsResponse } from "../src/automation/kucoin-ticker.js";

const normalized = normalizeKucoinStatsResponse({
  code: "200000",
  data: {
    symbol: "TEL-USDT",
    last: "0.00186",
    buy: "0.00185",
    sell: "0.00187",
    volValue: "123456.78",
    changeRate: "0.025",
    high: "0.00195",
    low: "0.00170"
  }
});
assert.deepEqual(normalized.data.list[0], {
  lastPrice: 0.00186,
  bestBidPrice: 0.00185,
  bestAskPrice: 0.00187,
  quoteVolume: 123456.78,
  priceChangePercent: 2.5,
  high: 0.00195,
  low: 0.0017
});
assert.throws(() => normalizeKucoinStatsResponse({ data: { last: "0.001" } }), /KUCOIN_STATS_SCHEMA_INVALID/);
assert.throws(() => normalizeKucoinStatsResponse({ data: { last: "0.001", buy: "0.002", sell: "0.001", volValue: "1", changeRate: "0", high: "0.002", low: "0.001" } }), /KUCOIN_STATS_SCHEMA_INVALID/);
console.log("KuCoin stats fallback normalization tests passed");
