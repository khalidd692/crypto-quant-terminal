import assert from "node:assert/strict";
import { normalizeMexcTelDerivatives } from "../src/context/providers/mexc-tel-derivatives.js";

const now = "2026-10-09T14:00:00.000Z";
const fresh = Date.parse(now);
const normalized = normalizeMexcTelDerivatives({
  now,
  funding: { success: true, code: 0, data: { symbol: "TEL_USDT", fundingRate: 0.0002, timestamp: fresh } },
  ticker: { success: true, code: 0, data: { symbol: "TEL_USDT", holdVol: 125, fairPrice: 0.002, timestamp: fresh } },
  contract: { success: true, code: 0, data: [{ symbol: "TEL_USDT", contractSize: 1000 }] },
});
assert.equal(normalized.fundingRate, 0.0002);
assert.equal(normalized.openInterestQuote, 250);
assert.equal(normalized.fundingReason, null);
assert.equal(normalized.openInterestReason, null);

const stale = normalizeMexcTelDerivatives({
  now,
  funding: { success: true, code: 0, data: { symbol: "TEL_USDT", fundingRate: 0.0002, timestamp: fresh - 16 * 60_000 } },
  ticker: { success: true, code: 0, data: { symbol: "TEL_USDT", holdVol: 125, fairPrice: 0.002, timestamp: fresh - 16 * 60_000 } },
  contract: { success: true, code: 0, data: [{ symbol: "TEL_USDT", contractSize: 1000 }] },
});
assert.equal(stale.fundingRate, null);
assert.equal(stale.openInterestQuote, null);
assert.equal(stale.fundingReason, "MEXC_TEL_FUNDING_STALE_OR_FUTURE");
assert.equal(stale.openInterestReason, "MEXC_TEL_TICKER_STALE_OR_FUTURE");

const wrongSymbol = normalizeMexcTelDerivatives({
  now,
  funding: { success: true, code: 0, data: { symbol: "BTC_USDT", fundingRate: 0, timestamp: fresh } },
  ticker: { success: true, code: 0, data: { symbol: "BTC_USDT", holdVol: 125, fairPrice: 0.002, timestamp: fresh } },
  contract: { success: true, code: 0, data: [{ symbol: "BTC_USDT", contractSize: 1 }] },
});
assert.equal(wrongSymbol.fundingRate, null);
assert.equal(wrongSymbol.openInterestQuote, null);

console.log("MEXC TEL derivatives context: PASS (symbol, freshness, quote conversion, fail-closed)");
