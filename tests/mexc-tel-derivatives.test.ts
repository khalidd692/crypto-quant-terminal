import assert from "node:assert/strict";
import { normalizeMexcTelDerivatives } from "../src/context/providers/mexc-tel-derivatives.js";

const now = "2026-10-10T20:30:00.000Z";
const timestamp = Date.parse(now);
const envelope = (data: Record<string, unknown>) => ({ success: true, code: 0, data });
const funding = envelope({ symbol: "TEL_USDT", fundingRate: 0, timestamp });
const validTicker = { symbol: "TEL_USDT", timestamp, holdVol: "10", fairPrice: "0.02" };
const validContract = { symbol: "TEL_USDT", state: 0, quoteCoin: "USDT", contractSize: "1" };

const valid = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope(validContract),
  now
});
assert.equal(valid.fundingRate, 0, "an explicit numeric zero funding rate is valid");
assert.equal(valid.openInterestQuote, 0.2);
assert.equal(valid.openInterestReason, null);

// Missing, null, and blank numeric fields must not be coerced to zero.
for (const missing of [null, undefined, "", "   "]) {
  const result = normalizeMexcTelDerivatives({
    funding,
    ticker: envelope({ ...validTicker, holdVol: missing }),
    contract: envelope(validContract),
    now
  });
  assert.equal(result.openInterestQuote, null, `holdVol ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID");
}

for (const missing of [null, undefined, "", "   "]) {
  const result = normalizeMexcTelDerivatives({
    funding,
    ticker: envelope({ ...validTicker, fairPrice: missing }),
    contract: envelope(validContract),
    now
  });
  assert.equal(result.openInterestQuote, null, `fairPrice ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID");
}

for (const missing of [null, undefined, "", "   "]) {
  const result = normalizeMexcTelDerivatives({
    funding,
    ticker: envelope(validTicker),
    contract: envelope({ ...validContract, contractSize: missing }),
    now
  });
  assert.equal(result.openInterestQuote, null, `contractSize ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID");
}

const missingFunding = normalizeMexcTelDerivatives({
  funding: envelope({ symbol: "TEL_USDT", fundingRate: null, timestamp }),
  ticker: envelope(validTicker),
  contract: envelope(validContract),
  now
});
assert.equal(missingFunding.fundingRate, null, "missing funding must not become a zero funding rate");
assert.equal(missingFunding.fundingReason, "MEXC_TEL_FUNDING_RATE_INVALID");


const contractNotListed = normalizeMexcTelDerivatives({
  funding: envelope({ symbol: "TEL_USDT", fundingRate: 0.000133, timestamp }),
  ticker: { success: true, code: 0 },
  contract: { success: false, code: 1001, message: "Contract not exists" },
  now
});
assert.equal(contractNotListed.fundingRate, null, "funding must not appear live when contract detail says TEL_USDT does not exist");
assert.equal(contractNotListed.fundingReason, "MEXC_TEL_PERP_NOT_LISTED");
assert.equal(contractNotListed.openInterestQuote, null, "empty ticker data must not become open interest");
assert.equal(contractNotListed.openInterestReason, "MEXC_TEL_TICKER_DATA_MISSING");

const emptyTicker = normalizeMexcTelDerivatives({
  funding,
  ticker: { success: true, code: 0 },
  contract: envelope(validContract),
  now
});
assert.equal(emptyTicker.openInterestQuote, null, "success envelope without data must remain unavailable");
assert.equal(emptyTicker.openInterestReason, "MEXC_TEL_TICKER_DATA_MISSING");


for (const state of [3, 4]) {
  const inactive = normalizeMexcTelDerivatives({
    funding: envelope({ symbol: "TEL_USDT", fundingRate: 0.000133, timestamp }),
    ticker: envelope(validTicker),
    contract: envelope({ ...validContract, state }),
    now
  });
  assert.equal(inactive.fundingRate, null, `contract state ${state} must not expose live funding`);
  assert.equal(inactive.fundingReason, "MEXC_TEL_PERP_NOT_ACTIVE");
  assert.equal(inactive.openInterestQuote, null, `contract state ${state} must not expose live open interest`);
  assert.equal(inactive.openInterestReason, "MEXC_TEL_PERP_NOT_ACTIVE");
}

const wrongQuoteCoin = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope({ ...validContract, quoteCoin: "BTC" }),
  now
});
assert.equal(wrongQuoteCoin.fundingRate, null, "a non-USDT-quoted contract must not be treated as TEL_USDT");
assert.equal(wrongQuoteCoin.fundingReason, "MEXC_TEL_PERP_NOT_ACTIVE");
assert.equal(wrongQuoteCoin.openInterestQuote, null);
assert.equal(wrongQuoteCoin.openInterestReason, "MEXC_TEL_PERP_NOT_ACTIVE");

const missingContractState = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope({ symbol: "TEL_USDT", quoteCoin: "USDT", contractSize: "1" }),
  now
});
assert.equal(missingContractState.fundingRate, null, "missing contract state must fail closed");
assert.equal(missingContractState.openInterestQuote, null, "missing contract state must fail closed for open interest");

console.log("MEXC TEL derivatives null/blank numeric tests passed.");
