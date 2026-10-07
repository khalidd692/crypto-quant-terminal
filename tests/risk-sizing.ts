import assert from "node:assert/strict";
import { assessPositionRisk } from "../src/risk/sizing.js";

const capped = assessPositionRisk({
  equityQuote: 1_000,
  maxRiskFraction: 0.1,
  entryPrice: 100,
  invalidationPrice: 99,
  leverage: 2,
  existingPortfolioRiskQuote: 0,
  portfolioRiskLimitQuote: 1_000,
});

assert.equal(capped.allowed, true);
assert.equal(capped.quantity, 20);
assert.equal(capped.positionNotionalQuote, 2_000);
assert.equal(capped.maxLossQuote, 20);
assert.equal(capped.portfolioRiskAfter, 20);
assert.equal(capped.methodologyVersion, "risk-sizing.v2");

const riskBudgetBound = assessPositionRisk({
  equityQuote: 1_000,
  maxRiskFraction: 0.1,
  entryPrice: 100,
  invalidationPrice: 50,
  leverage: 10,
  existingPortfolioRiskQuote: 0,
  portfolioRiskLimitQuote: 1_000,
});

assert.equal(riskBudgetBound.quantity, 2);
assert.equal(riskBudgetBound.positionNotionalQuote, 200);
assert.equal(riskBudgetBound.maxLossQuote, 100);

const blocked = assessPositionRisk({
  equityQuote: 1_000,
  maxRiskFraction: 0.1,
  entryPrice: 100,
  invalidationPrice: 90,
  leverage: 2,
  existingPortfolioRiskQuote: 950,
  portfolioRiskLimitQuote: 1_000,
});

assert.equal(blocked.allowed, false);
assert.equal(blocked.maxLossQuote, 100);
assert.equal(blocked.portfolioRiskAfter, 1_050);
assert.equal(blocked.reason, "portfolio_risk_limit");

console.log("risk-sizing: ok");
