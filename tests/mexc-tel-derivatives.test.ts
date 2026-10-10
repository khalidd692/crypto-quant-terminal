import assert from "node:assert/strict";
import { normalizeMexcTelDerivatives } from "../src/context/providers/mexc-tel-derivatives.js";

const now = "2026-10-10T20:30:00.000Z";
const timestamp = Date.parse(now);
const envelope = (data: unknown) => ({ success: true, code: 0, data });
const funding = envelope({ symbol: "TEL_USDT", fundingRate: 0, timestamp });
const validTicker = { symbol: "TEL_USDT", timestamp, holdVol: "10", fairPrice: "0.02" };
const validContract = { symbol: "TEL_USDT", state: 0, quoteCoin: "USDT", settleCoin: "USDT", contractSize: "1" };

const valid = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope([validContract]),
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
    contract: envelope([validContract]),
    now
  });
  assert.equal(result.openInterestQuote, null, `holdVol ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID");
}

for (const missing of [null, undefined, "", "   "]) {
  const result = normalizeMexcTelDerivatives({
    funding,
    ticker: envelope({ ...validTicker, fairPrice: missing }),
    contract: envelope([validContract]),
    now
  });
  assert.equal(result.openInterestQuote, null, `fairPrice ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID");
}

for (const missing of [null, undefined, "", "   "]) {
  const result = normalizeMexcTelDerivatives({
    funding,
    ticker: envelope(validTicker),
    contract: envelope([{ ...validContract, contractSize: missing }]),
    now
  });
  assert.equal(result.openInterestQuote, null, `contractSize ${String(missing)} must remain unavailable`);
  assert.equal(result.openInterestReason, "MEXC_TEL_CONTRACT_SIZE_INVALID");
}

const missingFunding = normalizeMexcTelDerivatives({
  funding: envelope({ symbol: "TEL_USDT", fundingRate: null, timestamp }),
  ticker: envelope(validTicker),
  contract: envelope([validContract]),
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
assert.equal(contractNotListed.fundingRate, null, "funding must not appear live when TEL is absent from official contract list");
assert.match(contractNotListed.fundingReason ?? "", /MEXC_TEL_PERP_NOT_LISTED/);
assert.equal(contractNotListed.openInterestQuote, null, "empty ticker data must not become open interest");

const emptyTicker = normalizeMexcTelDerivatives({
  funding,
  ticker: { success: true, code: 0 },
  contract: envelope([validContract]),
  now
});
assert.equal(emptyTicker.openInterestQuote, null, "success envelope without data must remain unavailable");
assert.equal(emptyTicker.openInterestReason, "MEXC_TEL_TICKER_DATA_MISSING");

const wrongQuoteCoin = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope([{ ...validContract, quoteCoin: "BTC" }]),
  now
});
assert.equal(wrongQuoteCoin.fundingRate, null, "a non-USDT-quoted contract must not be treated as TEL_USDT");
assert.equal(wrongQuoteCoin.fundingReason, "MEXC_TEL_PERP_NOT_USDT_SETTLED");
assert.equal(wrongQuoteCoin.openInterestQuote, null);

const wrongSettlement = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope([{ ...validContract, settleCoin: "BTC" }]),
  now
});
assert.equal(wrongSettlement.fundingRate, null, "a non-USDT-settled contract must not be treated as TEL_USDT");
assert.equal(wrongSettlement.fundingReason, "MEXC_TEL_PERP_NOT_USDT_SETTLED");
assert.equal(wrongSettlement.openInterestQuote, null);

const missingContractSize = normalizeMexcTelDerivatives({
  funding,
  ticker: envelope(validTicker),
  contract: envelope([{ symbol: "TEL_USDT", quoteCoin: "USDT", settleCoin: "USDT" }]),
  now
});
assert.equal(missingContractSize.fundingRate, null, "missing contract size must fail closed");
assert.equal(missingContractSize.openInterestQuote, null, "missing contract size must fail closed for open interest");


const inactiveState3 = normalizeMexcTelDerivatives({
  funding, ticker: envelope(validTicker),
  contract: envelope([{ ...validContract, state: 3 }]), now
});
assert.equal(inactiveState3.fundingRate, null, "state 3 must fail closed");
assert.equal(inactiveState3.fundingReason, "MEXC_TEL_PERP_NOT_ACTIVE");

const inactiveState4 = normalizeMexcTelDerivatives({
  funding, ticker: envelope(validTicker),
  contract: envelope([{ ...validContract, state: 4 }]), now
});
assert.equal(inactiveState4.fundingRate, null, "state 4 must fail closed");
assert.equal(inactiveState4.fundingReason, "MEXC_TEL_PERP_NOT_ACTIVE");

const wrongContractSymbol = normalizeMexcTelDerivatives({
  funding, ticker: envelope(validTicker),
  contract: envelope([{ ...validContract, symbol: "TEL_USDC" }]), now
});
assert.equal(wrongContractSymbol.fundingRate, null, "wrong contract symbol must fail closed");
assert.match(wrongContractSymbol.fundingReason ?? "", /MEXC_TEL_PERP_NOT_LISTED/);

const fundingDespiteInvalidContract = normalizeMexcTelDerivatives({
  funding: envelope({ symbol: "TEL_USDT", fundingRate: 0.000133, timestamp, fairPrice: "0.02", idxPrice: "0.02" }),
  ticker: { success: true, code: 0 },
  contract: { success: false, code: 1001, message: "Contract not exists" },
  now
});
assert.equal(fundingDespiteInvalidContract.fundingRate, null);
assert.equal(fundingDespiteInvalidContract.openInterestQuote, null);
assert.match(fundingDespiteInvalidContract.fundingReason ?? "", /NOT_LISTED/);
\nconsole.log("MEXC TEL derivatives regression tests passed.");
