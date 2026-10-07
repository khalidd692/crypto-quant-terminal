import type { MarketDataPoint } from "../domain/types.js";
import type { ResearchObservation } from "./observation-ledger.js";
import type { BinanceFundingRate } from "../adapters/binance/public-client.js";
import { simulateOutcome } from "../simulation/outcomes.js";
import { assessFunding } from "./funding.js";
import { summaryForReturns, type ReturnSummary, drawdownForReturns, type DrawdownSummary } from "./report-utils.js";

export interface BaselineSummary {
  readonly name: "NO_TRADE" | "RANDOM_ENTRY" | "ALWAYS_LONG" | "BUY_AND_HOLD";
  readonly seed: number | null;
  readonly returns: ReturnSummary;
  readonly drawdown: DrawdownSummary;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function counterfactualR(
  observation: ResearchObservation,
  side: "LONG" | "SHORT",
  pointsByTime: ReadonlyMap<string, MarketDataPoint>,
  feeRate: number,
  slippageRate: number,
  fundingRates: readonly BinanceFundingRate[],
): number | null {
  if (!observation.eligible || observation.side === null || observation.outcome === null) return null;
  const entry = pointsByTime.get(observation.eventTime);
  if (!entry || observation.targetR === null || observation.invalidationR === null) return null;
  const atrRatio = observation.featureSnapshot.find((f) => f.featureId === "volatility.atr_ratio")?.value;
  if (atrRatio === null || atrRatio === undefined || !Number.isFinite(atrRatio) || atrRatio <= 0) return null;
  const atr = entry.close * atrRatio;
  const targetPrice = side === "LONG" ? entry.close + observation.targetR * atr : entry.close - observation.targetR * atr;
  const invalidationPrice = side === "LONG" ? entry.close - observation.invalidationR * atr : entry.close + observation.invalidationR * atr;
  const end = Date.parse(observation.horizonEndTime ?? "");
  if (!Number.isFinite(end)) return null;
  const future = [...pointsByTime.values()].filter((p) => {
    const t = Date.parse(p.eventTime); return t > Date.parse(entry.eventTime) && t <= end;
  }).sort((a,b) => a.eventTime.localeCompare(b.eventTime));
  if (!future.length) return null;
  const simulated = simulateOutcome(entry, future, { side, entryPrice: entry.close, targetPrice, invalidationPrice, feeRate, slippageRate });
  if (simulated.intrabarAmbiguous) return null;
  const funding = assessFunding(side, entry.eventTime, simulated.exitEventTime, fundingRates);
  const risk = Math.abs(entry.close - invalidationPrice);
  return (simulated.returnFraction + funding.paymentReturnFraction) / (risk / entry.close);
}

export function buildBaselines(
  observations: readonly ResearchObservation[],
  points: readonly MarketDataPoint[],
  fundingRates: readonly BinanceFundingRate[],
  costs: { readonly feeRate: number; readonly slippageRate: number },
  randomSeed = 20261007,
): readonly BaselineSummary[] {
  const map = new Map(points.map((p) => [p.eventTime, p]));
  const eligible = observations.filter((o) => o.eligible && o.outcome !== null && !o.outcome.intrabarAmbiguous);
  const random = rng(randomSeed);
  const randomReturns: number[] = [];
  const longReturns: number[] = [];
  for (const observation of eligible) {
    const randomSide = random() < 0.5 ? "LONG" : "SHORT";
    const r = counterfactualR(observation, randomSide, map, costs.feeRate, costs.slippageRate, fundingRates);
    const l = counterfactualR(observation, "LONG", map, costs.feeRate, costs.slippageRate, fundingRates);
    if (r !== null) randomReturns.push(r);
    if (l !== null) longReturns.push(l);
  }
  const noTrade: BaselineSummary = { name: "NO_TRADE", seed: null, returns: summaryForReturns([]), drawdown: drawdownForReturns([]) };
  const randomEntry: BaselineSummary = { name: "RANDOM_ENTRY", seed: randomSeed, returns: summaryForReturns(randomReturns), drawdown: drawdownForReturns(randomReturns) };
  const alwaysLong: BaselineSummary = { name: "ALWAYS_LONG", seed: null, returns: summaryForReturns(longReturns), drawdown: drawdownForReturns(longReturns) };
  return [noTrade, randomEntry, alwaysLong];
}

export function buildBuyAndHoldBaseline(points: readonly MarketDataPoint[], feeRate: number, slippageRate: number): BaselineSummary {
  if (points.length < 2) return { name: "BUY_AND_HOLD", seed: null, returns: summaryForReturns([]), drawdown: drawdownForReturns([]) };
  const first = points[0]!, last = points.at(-1)!;
  const entry = first.close * (1 + feeRate + slippageRate);
  const exit = last.close * (1 - feeRate - slippageRate);
  const realized = exit / entry - 1;
  return { name: "BUY_AND_HOLD", seed: null, returns: summaryForReturns([realized]), drawdown: drawdownForReturns([realized]) };
}
