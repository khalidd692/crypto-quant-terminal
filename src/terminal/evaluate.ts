import type { Signal } from "../domain/types.js";
import { computeCoreFeatures, requireFeatureHistory } from "../features/feature-engine.js";
import { classifyBasicRegime } from "../regime/classifier.js";
import { assessBasicTrendSetup } from "../setup/basic.js";
import { evaluateDecisionPipeline } from "../decision/pipeline.js";
import { assessLiquidity } from "../risk/liquidity.js";
import { calculatePositionSize } from "../risk/sizing.js";
import type { BinanceBookTicker } from "../adapters/binance/public-client.js";
import type { FrozenTerminalEstimator } from "./model.js";
import type { MarketDataPoint } from "../domain/types.js";

export interface TerminalEvaluationContext {
  readonly bookTicker: BinanceBookTicker;
  readonly estimator: FrozenTerminalEstimator;
  readonly equityQuote: number;
  readonly existingPortfolioRiskQuote: number;
  readonly portfolioRiskLimitQuote: number;
  readonly maxRiskFraction: number;
  readonly maxLeverage: number;
}

export interface TerminalEvaluation {
  readonly signal: Signal;
  readonly featureCount: number;
  readonly regime: string;
  readonly setup: string;
}

export function evaluateReadOnly(
  instrumentId: string,
  points: readonly MarketDataPoint[],
  dataVersion: string,
  decisionTime: string,
  context: TerminalEvaluationContext,
): TerminalEvaluation {
  requireFeatureHistory(points, 50);
  const last = points.at(-1);
  if (!last) throw new Error("No market data");

  const features = computeCoreFeatures({
    instrumentId,
    eventTime: last.eventTime,
    availableTime: last.availableTime,
    dataVersion,
    points,
  });
  const regime = classifyBasicRegime({ instrumentId, eventTime: last.eventTime, featureSnapshots: features, version: "basic-regime-v1" });
  const setup = assessBasicTrendSetup(features);
  const atrRatio = features.find((feature) => feature.featureId === "volatility.atr_ratio")?.value ?? null;
  const invalidationPrice = setup.side !== null && atrRatio !== null && atrRatio > 0
    ? setup.side === "LONG" ? last.close * (1 - atrRatio) : last.close * (1 + atrRatio)
    : null;

  const mid = (context.bookTicker.bidPrice + context.bookTicker.askPrice) / 2;
  const spreadBps = mid > 0 ? ((context.bookTicker.askPrice - context.bookTicker.bidPrice) / mid) * 10_000 : Infinity;
  const topDepthQuote = Math.min(
    context.bookTicker.bidPrice * context.bookTicker.bidQty,
    context.bookTicker.askPrice * context.bookTicker.askQty,
  );
  const provisionalSizing = setup.side !== null && invalidationPrice !== null
    ? calculatePositionSize({
        equityQuote: context.equityQuote,
        maxRiskFraction: context.maxRiskFraction,
        entryPrice: last.close,
        invalidationPrice,
        contractMultiplier: 1,
        maxLeverage: context.maxLeverage,
        availableLiquidityQuote: topDepthQuote,
      })
    : null;
  const orderNotionalQuote = provisionalSizing?.notionalQuote ?? 0;
  const liquidity = orderNotionalQuote > 0
    ? assessLiquidity({
        spreadBps,
        estimatedSlippageBps: Math.max(0, spreadBps / 2),
        depthQuote: topDepthQuote,
        orderNotionalQuote,
        maxSpreadBps: 5,
        maxSlippageBps: 5,
        minDepthMultiple: 5,
      })
    : {
        passed: false,
        spreadBps,
        estimatedSlippageBps: Math.max(0, spreadBps / 2),
        depthQuote: topDepthQuote,
        stressScenario: "depth>=5x_order_notional",
        methodologyVersion: "liquidity-gate.v1" as const,
        reason: "position_size_zero",
      };

  const distribution = setup.side !== null ? context.estimator.predict(setup.side) : null;
  const decision = evaluateDecisionPipeline({
    side: setup.side,
    outcomeDistribution: distribution,
    evidencePolicy: { maxTargetIntervalWidth: 0.5, maxAmbiguousProbability: 0.25 },
    minExpectedValueR: 0,
    dataValid: true,
    dataFresh: Date.parse(context.bookTicker.eventTime) >= Date.parse(last.eventTime),
    liquidityPassed: liquidity.passed,
    portfolioRiskAllowed: provisionalSizing !== null
      ? context.existingPortfolioRiskQuote + provisionalSizing.riskBudgetQuote <= context.portfolioRiskLimitQuote
      : false,
    invalidationDefined: invalidationPrice !== null,
  });

  const signal: Signal = {
    signalId: `signal:${instrumentId}:${decisionTime}` as Signal["signalId"],
    instrumentId,
    decisionTime: decisionTime as Signal["decisionTime"],
    decision: decision.decision,
    side: decision.side,
    regimeId: regime.regimeId,
    setupId: setup.setupId,
    featureSnapshotIds: features.map((feature, index) => `${feature.featureId}:${index}` as Signal["featureSnapshotIds"][number]),
    probabilities: distribution?.probabilities.map((item) => ({
      event: item.event,
      probability: item.probability,
      sampleSize: item.count,
      estimatorVersion: distribution.estimatorVersion,
    })) ?? [],
    uncertainty: distribution?.probabilities.map((item) => ({
      method: item.adjustedUncertainty.method,
      lower: item.adjustedUncertainty.interval.lower,
      upper: item.adjustedUncertainty.interval.upper,
      level: 0.95,
    })) ?? [],
    expectancy: decision.expectancy,
    invalidation: invalidationPrice === null ? null : {
      type: "price",
      reference: "ATR(14) x 1.0R",
      level: invalidationPrice,
      rationale: "Frozen Phase 3 invalidation definition",
    },
    risk: provisionalSizing === null ? null : {
      riskVersion: "risk-sizing.v2",
      maxLossQuote: provisionalSizing.riskBudgetQuote,
      volatility: atrRatio,
      invalidationDistance: invalidationPrice === null ? null : Math.abs(last.close - invalidationPrice),
      leverage: provisionalSizing.effectiveLeverage,
      portfolioRiskBefore: context.existingPortfolioRiskQuote,
      portfolioRiskAfter: context.existingPortfolioRiskQuote + provisionalSizing.riskBudgetQuote,
      correlationToPortfolio: null,
      betaToReference: null,
    },
    liquidity: {
      passed: liquidity.passed,
      spreadBps: liquidity.spreadBps,
      estimatedSlippageBps: liquidity.estimatedSlippageBps,
      depthQuote: liquidity.depthQuote,
      stressScenario: liquidity.stressScenario,
      methodologyVersion: liquidity.methodologyVersion,
    },
    vetoReasons: decision.vetoReasons,
    datasetVersion: dataVersion,
    modelVersion: context.estimator.modelVersion,
    decisionPolicyVersion: "decision-policy-v1",
  };
  return { signal, featureCount: features.length, regime: regime.label, setup: setup.valid ? setup.setupId : "NONE" };
}
