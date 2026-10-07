import { assessLiquidity } from "../src/risk/liquidity.js";
import { evaluateDecisionPipeline } from "../src/decision/pipeline.js";
import { estimateBinomial, expectedValue } from "../src/statistics/binomial.js";
import { calculatePositionSize } from "../src/risk/sizing.js";

const estimate = estimateBinomial(60, 100);
if (estimate.probability !== 0.6) throw new Error("Binomial estimate mismatch");
if (!(estimate.interval.lower < 0.6 && estimate.interval.upper > 0.6)) throw new Error("Wilson interval invalid");

if (expectedValue([0.5, 0.5], [2, -1]) !== 0.5) throw new Error("Expected value mismatch");

const liquidity = assessLiquidity({
  spreadBps: 2,
  estimatedSlippageBps: 1,
  depthQuote: 100_000,
  orderNotionalQuote: 10_000,
  maxSpreadBps: 5,
  maxSlippageBps: 5,
  minDepthMultiple: 5,
});
if (!liquidity.passed) throw new Error("Liquidity gate should pass");

const decision = evaluateDecisionPipeline({
  side: "LONG",
  outcomeDistribution: null,
  evidencePolicy: { maxTargetIntervalWidth: 0.8, maxAmbiguousProbability: 0 },
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: false,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
if (decision.decision !== "NO_TRADE") throw new Error("Decision pipeline veto mismatch");

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
