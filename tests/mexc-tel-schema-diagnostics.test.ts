import assert from "node:assert/strict";
import { normalizeMexcTelDerivatives } from "../src/context/providers/mexc-tel-derivatives.js";

const now = "2026-10-10T20:00:00.000Z";
const timestamp = Date.parse(now);
const funding = { success: true, code: 0, data: { symbol: "TEL_USDT", fundingRate: 0.0001, timestamp } };
const contract = { success: true, code: 0, data: [{ symbol: "TEL_USDT", quoteCoin: "USDT", settleCoin: "USDT", contractSize: 1 }] };

const valid = normalizeMexcTelDerivatives({
  funding,
  ticker: { success: true, code: 0, data: { symbol: "TEL_USDT", holdVol: 100, fairPrice: 0.01, timestamp } },
  contract,
  now
});
assert.equal(valid.fundingRate, 0.0001);
assert.equal(valid.openInterestQuote, 1);

const absent = normalizeMexcTelDerivatives({
  funding,
  ticker: { success: true, code: 0, data: [{ symbol: "BTC_USDT" }, { symbol: "ETH_USDT" }] },
  contract,
  now
});
assert.equal(absent.openInterestQuote, null);
assert.match(absent.openInterestReason ?? "", /MEXC_TEL_TICKER_SYMBOL_ABSENT/);
assert.match(absent.openInterestReason ?? "", /BTC_USDT,ETH_USDT/);

const rejected = normalizeMexcTelDerivatives({
  funding,
  ticker: { success: false, code: 6004, message: "trading pair is not available" },
  contract,
  now
});
assert.equal(rejected.openInterestQuote, null);
assert.match(rejected.openInterestReason ?? "", /MEXC_TEL_TICKER_API_ERROR/);
assert.match(rejected.openInterestReason ?? "", /6004/);

console.log("MEXC schema diagnostics tests passed.");
