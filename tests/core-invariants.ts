import { evaluateLiquidity } from "../src/liquidity/gate.js";
import { decide } from "../src/decision/engine.js";
import { estimateBinomial, expectedValue } from "../src/statistics/binomial.js";
import { calculatePositionSize } from "../src/risk/position-sizing.js";

const estimate = estimateBinomial(60, 100);
if (estimate.probability !== 0.6) throw new Error("Binomial estimate mismatch");
if (!(estimate.interval.lower < 0.6 && estimate.interval.upper > 0.6)) throw new Error("Wilson interval invalid");

if (expectedValue([0.5, 0.5], [2, -1]) !== 0.5) throw new Error("Expected value mismatch");

const liquidity = evaluateLiquidity({
  spreadBps: 2,
  estimatedSlippageBps: 1,
  depthQuote: 100_000,
  requiredNotionalQuote: 10_000,
  maxSpreadBps: 5,
  maxSlippageBps: 5,
  minDepthMultiple: 5,
});
if (!liquidity.passed) throw new Error("Liquidity gate should pass");

const decision = decide({
  directionalSide: "LONG",
  evidenceSufficient: true,
  expectancy: { expectedValue: 0.2, unit: "R", gross: 0.4, fees: 0.1, slippage: 0.1, funding: 0, methodologyVersion: "v1" },
  minExpectedValue: 0.1,
  liquidity: { passed: true, spreadBps: 2, estimatedSlippageBps: 1, depthQuote: 100_000, stressScenario: "5x", methodologyVersion: "v1" },
  risk: { riskVersion: "v1", maxLossQuote: 100, volatility: 0.02, invalidationDistance: 10, leverage: 1, portfolioRiskBefore: 100, portfolioRiskAfter: 200, correlationToPortfolio: 0.2, betaToReference: 1 },
  vetoReasons: [],
});
if (decision.decision !== "LONG") throw new Error("Decision engine mismatch");

const sizing = calculatePositionSize({
  equityQuote: 10_000,
  maxRiskFraction: 0.01,
  entryPrice: 100,
  invalidationPrice: 95,
  contractMultiplier: 1,
  maxLeverage: 2,
  availableLiquidityQuote: 100_000,
});
if (sizing.cappedUnits <= 0 || sizing.effectiveLeverage > 2) throw new Error("Position sizing mismatch");
