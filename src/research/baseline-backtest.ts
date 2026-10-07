import type { MarketDataPoint, Side } from "../domain/types.js";
import { computeCoreFeatures } from "../features/feature-engine.js";
import { assessBasicTrendSetup } from "../setup/basic.js";
import { averageTrueRange } from "../features/indicators.js";
import { simulateOutcome, type SimulatedOutcome } from "../simulation/outcomes.js";
import { estimateBinomial, type BinomialEstimate } from "../statistics/binomial.js";

export interface BaselineTradeObservation {
  readonly eventTime: string;
  readonly side: Side;
  readonly outcome: SimulatedOutcome;
}

export interface BaselineBacktestResult {
  readonly observations: readonly BaselineTradeObservation[];
  readonly eligibleSetups: number;
  readonly ambiguousCount: number;
}

export interface BaselineSummary {
  readonly observations: number;
  readonly targetSuccesses: number;
  readonly targetProbability: BinomialEstimate | null;
  readonly meanReturn: number | null;
  readonly totalReturn: number;
  readonly ambiguousExcluded: number;
}

export interface BaselineConfig {
  readonly lookback: number;
  readonly horizon: number;
  readonly targetR: number;
  readonly invalidationR: number;
  readonly feeRate: number;
  readonly slippageRate: number;
  readonly dataVersion: string;
}

export function runBaselineBacktest(
  points: readonly MarketDataPoint[],
  config: BaselineConfig,
  startIndex = config.lookback,
  endIndex = points.length - config.horizon,
): BaselineBacktestResult {
  if (config.targetR <= 0 || config.invalidationR <= 0) throw new Error("Target and invalidation R must be positive");
  const observations: BaselineTradeObservation[] = [];
  let eligibleSetups = 0;
  let ambiguousCount = 0;

  const first = Math.max(config.lookback, startIndex);
  const last = Math.min(endIndex, points.length - config.horizon);
  for (let i = first; i <= last; i += 1) {
    const entry = points[i];
    if (!entry) continue;

    const history = points.slice(0, i + 1);
    const features = computeCoreFeatures({
      instrumentId: entry.instrumentId,
      eventTime: entry.eventTime,
      availableTime: entry.availableTime,
      dataVersion: config.dataVersion,
      points: history,
    });
    const setup = assessBasicTrendSetup(features);
    if (!setup.valid || setup.side === null) continue;
    eligibleSetups += 1;

    const atrRatio = features.find((feature) => feature.featureId === "volatility.atr_ratio")?.value;
    if (atrRatio === null || atrRatio === undefined || atrRatio <= 0) continue;
    const atr = entry.close * atrRatio;
    const target = setup.side === "LONG"
      ? entry.close + config.targetR * atr
      : entry.close - config.targetR * atr;
    const invalidation = setup.side === "LONG"
      ? entry.close - config.invalidationR * atr
      : entry.close + config.invalidationR * atr;

    const outcome = simulateOutcome(entry, points.slice(i + 1, i + 1 + config.horizon), {
      side: setup.side,
      entryPrice: entry.close,
      targetPrice: target,
      invalidationPrice: invalidation,
      feeRate: config.feeRate,
      slippageRate: config.slippageRate,
    });

    if (outcome.intrabarAmbiguous) ambiguousCount += 1;
    observations.push({ eventTime: entry.eventTime, side: setup.side, outcome });
  }

  return { observations, eligibleSetups, ambiguousCount };
}

export function summarizeBaseline(result: BaselineBacktestResult): BaselineSummary {
  const clean = result.observations.filter((observation) => !observation.outcome.intrabarAmbiguous);
  const successes = clean.filter((observation) => observation.outcome.targetHit).length;
  const returns = clean.map((observation) => observation.outcome.returnFraction);
  const totalReturn = returns.reduce((sum, value) => sum + value, 0);
  return {
    observations: clean.length,
    targetSuccesses: successes,
    targetProbability: clean.length > 0 ? estimateBinomial(successes, clean.length) : null,
    meanReturn: clean.length > 0 ? totalReturn / clean.length : null,
    totalReturn,
    ambiguousExcluded: result.ambiguousCount,
  };
}
