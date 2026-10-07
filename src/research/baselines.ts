import type { MarketDataPoint } from "../domain/types.js";
import type { ResearchObservation } from "./observation-ledger.js";
import type { BinanceFundingRate } from "../adapters/binance/public-client.js";
import { simulateOutcome } from "../simulation/outcomes.js";
import { assessFunding } from "./funding.js";
import { summarizeDrawdown, summarizeReturns, type SimpleDrawdownSummary, type SimpleReturnSummary } from "./report-utils.js";

export interface RandomEntryDistribution {
  readonly draws: number;
  readonly masterSeed: number;
  readonly meanRealizedRByDraw: readonly number[];
  readonly percentile95MeanR: number;
  readonly meanOfDrawMeans: number;
}

export interface BaselineSummary {
  readonly name: "NO_TRADE" | "BUY_AND_HOLD" | "RANDOM_ENTRY" | "ALWAYS_LONG";
  readonly seed: number | null;
  readonly draws: number | null;
  readonly returns: SimpleReturnSummary;
  readonly drawdown: SimpleDrawdownSummary;
  readonly randomDistribution?: RandomEntryDistribution;
}

interface Counterfactual {
  readonly longR: number;
  readonly shortR: number;
}

function randomUnit(seed: number): number {
  let state = seed >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

function counterfactual(
  observation: ResearchObservation,
  points: readonly MarketDataPoint[],
  side: "LONG" | "SHORT",
  feeRate: number,
  slippageRate: number,
  fundingRates: readonly BinanceFundingRate[],
): number | null {
  if (!observation.eligible || observation.outcome === null || observation.targetR === null || observation.invalidationR === null) return null;
  const entryIndex = points.findIndex((point) => point.eventTime === observation.eventTime);
  if (entryIndex < 0) return null;
  const entry = points[entryIndex];
  if (!entry) return null;
  const atrRatio = observation.featureSnapshot.find((feature) => feature.featureId === "volatility.atr_ratio")?.value;
  if (atrRatio === null || atrRatio === undefined || !Number.isFinite(atrRatio) || atrRatio <= 0) return null;
  const atr = entry.close * atrRatio;
  const targetPrice = side === "LONG" ? entry.close + observation.targetR * atr : entry.close - observation.targetR * atr;
  const invalidationPrice = side === "LONG" ? entry.close - observation.invalidationR * atr : entry.close + observation.invalidationR * atr;
  const future = points.slice(entryIndex + 1, entryIndex + 1 + 8);
  if (future.length < 8) return null;
  const simulated = simulateOutcome(entry, future, {
    side,
    entryPrice: entry.close,
    targetPrice,
    invalidationPrice,
    feeRate,
    slippageRate,
  });
  if (simulated.intrabarAmbiguous) return null;
  const funding = assessFunding(side, entry.eventTime, simulated.exitEventTime, fundingRates);
  const risk = Math.abs(entry.close - invalidationPrice);
  return (simulated.returnFraction + funding.paymentReturnFraction) / (risk / entry.close);
}

function percentile(values: readonly number[], p: number): number {
  if (!values.length) throw new Error("Cannot compute percentile of empty distribution");
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}

export function buildBaselines(
  observations: readonly ResearchObservation[],
  points: readonly MarketDataPoint[],
  fundingRates: readonly BinanceFundingRate[],
  costs: { readonly feeRate: number; readonly slippageRate: number },
  masterSeed: number,
  randomDraws: number,
): readonly BaselineSummary[] {
  if (!Number.isInteger(randomDraws) || randomDraws < 1) throw new Error("randomDraws must be a positive integer");
  const eligible = observations.filter((observation) => observation.eligible && observation.outcome !== null && !observation.outcome.intrabarAmbiguous);
  const counterfactuals: Counterfactual[] = [];
  for (const observation of eligible) {
    const longR = counterfactual(observation, points, "LONG", costs.feeRate, costs.slippageRate, fundingRates);
    const shortR = counterfactual(observation, points, "SHORT", costs.feeRate, costs.slippageRate, fundingRates);
    if (longR !== null && shortR !== null) counterfactuals.push({ longR, shortR });
  }
  const alwaysLongReturns = counterfactuals.map((value) => value.longR);
  const meanDistribution: number[] = [];
  for (let draw = 0; draw < randomDraws; draw += 1) {
    const seed = masterSeed + draw;
    const returns = counterfactuals.map((value, index) => randomUnit(seed + index * 0x9e3779b9) < 0.5 ? value.longR : value.shortR);
    meanDistribution.push(summarizeReturns(returns).mean ?? 0);
  }
  const randomDistribution: RandomEntryDistribution = {
    draws: randomDraws,
    masterSeed,
    meanRealizedRByDraw: meanDistribution,
    percentile95MeanR: percentile(meanDistribution, 0.95),
    meanOfDrawMeans: summarizeReturns(meanDistribution).mean ?? 0,
  };
  const noTrade: BaselineSummary = {
    name: "NO_TRADE",
    seed: null,
    draws: null,
    returns: summarizeReturns([]),
    drawdown: summarizeDrawdown([]),
  };
  const alwaysLong: BaselineSummary = {
    name: "ALWAYS_LONG",
    seed: null,
    draws: null,
    returns: summarizeReturns(alwaysLongReturns),
    drawdown: summarizeDrawdown(alwaysLongReturns),
  };
  const randomEntry: BaselineSummary = {
    name: "RANDOM_ENTRY",
    seed: masterSeed,
    draws: randomDraws,
    returns: summarizeReturns(meanDistribution),
    drawdown: summarizeDrawdown(meanDistribution),
    randomDistribution,
  };
  return [noTrade, randomEntry, alwaysLong];
}

export function buildBuyAndHoldBaseline(
  points: readonly MarketDataPoint[],
  feeRate: number,
  slippageRate: number,
): BaselineSummary {
  if (points.length < 2) {
    return { name: "BUY_AND_HOLD", seed: null, draws: null, returns: summarizeReturns([]), drawdown: summarizeDrawdown([]) };
  }
  const first = points[0]!;
  const last = points.at(-1)!;
  const entry = first.close * (1 + feeRate + slippageRate);
  const exit = last.close * (1 - feeRate - slippageRate);
  const realized = exit / entry - 1;
  return {
    name: "BUY_AND_HOLD",
    seed: null,
    draws: null,
    returns: summarizeReturns([realized]),
    drawdown: summarizeDrawdown([realized]),
  };
}
