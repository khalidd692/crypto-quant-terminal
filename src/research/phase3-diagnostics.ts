import type { MarketDataPoint, Side } from "../domain/types.js";
import type { BinanceFundingRate } from "../adapters/binance/public-client.js";
import type { ResearchObservation, OutcomeLabel } from "./observation-ledger.js";
import { assessFunding } from "./funding.js";
import { simulateOutcome } from "../simulation/outcomes.js";

export const DIAGNOSTIC_STATES = ["TARGET", "INVALIDATION", "TIME_EXIT"] as const;
export type DiagnosticState = typeof DIAGNOSTIC_STATES[number];

export const EXCLUSION_CATEGORIES = [
  "warmup",
  "setup_non_eligible",
  "overlap",
  "missing_data",
  "funding",
  "risk_out_of_bounds",
  "other",
] as const;
export type ExclusionCategory = typeof EXCLUSION_CATEGORIES[number];

export interface ExclusionDiagnostic {
  readonly totalObservations: number;
  readonly cleanEligible: number;
  readonly ambiguous: number;
  readonly excludedNonAmbiguous: number;
  readonly byCategory: Readonly<Record<ExclusionCategory, number>>;
  readonly excludedNonAmbiguousCheck: number;
}

export interface StateMeanDiagnostic {
  readonly count: number;
  readonly meanGrossR: number | null;
  readonly meanNetR: number | null;
  /** Positive values are costs; funding keeps its signed payment convention. */
  readonly meanFeesR: number | null;
  readonly meanSlippageR: number | null;
  readonly meanFundingR: number | null;
}

export interface RandomEntryStateDiagnostic extends StateMeanDiagnostic {
  readonly draws: number;
  readonly observationsAcrossDraws: number;
}

export interface Phase3StateDiagnostics {
  readonly strategy: Readonly<Record<DiagnosticState, StateMeanDiagnostic>>;
  readonly randomEntry: Readonly<Record<DiagnosticState, RandomEntryStateDiagnostic>>;
}

function categoryForExclusion(observation: ResearchObservation): ExclusionCategory {
  switch (observation.exclusionReason) {
    case "NO_BASELINE_SETUP": return "setup_non_eligible";
    case "INVALID_ATR": return "risk_out_of_bounds";
    case "OVERLAPPING_HORIZON": return "overlap";
    case "MISSING_DATA": return "missing_data";
    case "FUNDING_UNAVAILABLE": return "funding";
    case "WARMUP": return "warmup";
    default: return "other";
  }
}

function riskFraction(observation: ResearchObservation): number | null {
  const atrRatio = observation.featureSnapshot.find((feature) => feature.featureId === "volatility.atr_ratio")?.value;
  if (atrRatio === null || atrRatio === undefined || !Number.isFinite(atrRatio)) return null;
  const risk = atrRatio * (observation.invalidationR ?? 0);
  return risk > 0 ? risk : null;
}

function grossR(observation: ResearchObservation): number | null {
  const outcome = observation.outcome;
  const risk = riskFraction(observation);
  if (!outcome || risk === null) return null;
  // returnFraction is already net of fees and slippage. Reconstruct the
  // no-cost, no-slippage return; slippageReturn is signed as slipped minus
  // slippage-free return, so subtract it to remove its effect.
  return (outcome.returnFraction + outcome.feesReturn - outcome.slippageReturn) / risk;
}

function costAndFundingR(observation: ResearchObservation): { feesR: number; slippageR: number; fundingR: number } | null {
  const outcome = observation.outcome;
  const risk = riskFraction(observation);
  if (!outcome || risk === null) return null;
  return {
    feesR: outcome.feesReturn / risk,
    slippageR: -outcome.slippageReturn / risk,
    fundingR: outcome.fundingReturn / risk,
  };
}

function emptyStateMap<T>(): Record<DiagnosticState, T> {
  return {
    TARGET: undefined as T,
    INVALIDATION: undefined as T,
    TIME_EXIT: undefined as T,
  };
}

export function buildExclusionDiagnostic(
  observations: readonly ResearchObservation[],
  outsideObservationWindow?: { readonly warmup: number; readonly tail: number },
): ExclusionDiagnostic & { readonly outsideObservationWindow: { readonly warmup: number; readonly tail: number } } {
  const byCategory: Record<ExclusionCategory, number> = {
    warmup: outsideObservationWindow?.warmup ?? 0,
    setup_non_eligible: 0,
    overlap: 0,
    missing_data: 0,
    funding: 0,
    risk_out_of_bounds: 0,
    other: 0,
  };
  let ambiguous = 0;
  for (const observation of observations) {
    if (observation.outcome?.intrabarAmbiguous) {
      ambiguous += 1;
      continue;
    }
    if (observation.eligible && observation.outcome !== null) continue;
    byCategory[categoryForExclusion(observation)] += 1;
  }
  const excludedNonAmbiguous = Object.values(byCategory).reduce((sum, count) => sum + count, 0)
    - byCategory.warmup - (outsideObservationWindow?.tail ?? 0);
  return {
    totalObservations: observations.length,
    cleanEligible: observations.filter((o) => o.eligible && o.outcome !== null && !o.outcome.intrabarAmbiguous).length,
    ambiguous,
    excludedNonAmbiguous,
    byCategory,
    excludedNonAmbiguousCheck: observations.length
      - observations.filter((o) => o.eligible && o.outcome !== null && !o.outcome.intrabarAmbiguous).length
      - ambiguous,
    outsideObservationWindow: {
      warmup: outsideObservationWindow?.warmup ?? 0,
      tail: outsideObservationWindow?.tail ?? 0,
    },
  };
}

function stateMeans(
  observations: readonly ResearchObservation[],
): Readonly<Record<DiagnosticState, StateMeanDiagnostic>> {
  const sums: Record<DiagnosticState, { count: number; gross: number; net: number; fees: number; slippage: number; funding: number }> = {
    TARGET: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
    INVALIDATION: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
    TIME_EXIT: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
  };
  for (const observation of observations) {
    if (!observation.eligible || !observation.outcome || observation.outcome.intrabarAmbiguous) continue;
    const state = observation.outcome.label;
    if (!DIAGNOSTIC_STATES.includes(state as DiagnosticState)) continue;
    const gross = grossR(observation);
    const costs = costAndFundingR(observation);
    if (gross === null || costs === null) continue;
    sums[state as DiagnosticState].count += 1;
    sums[state as DiagnosticState].gross += gross;
    sums[state as DiagnosticState].net += observation.outcome.realizedR;
    sums[state as DiagnosticState].fees += costs.feesR;
    sums[state as DiagnosticState].slippage += costs.slippageR;
    sums[state as DiagnosticState].funding += costs.fundingR;
  }
  const result = emptyStateMap<StateMeanDiagnostic>();
  for (const state of DIAGNOSTIC_STATES) {
    const item = sums[state];
    result[state] = {
      count: item.count,
      meanGrossR: item.count ? item.gross / item.count : null,
      meanNetR: item.count ? item.net / item.count : null,
      meanFeesR: item.count ? item.fees / item.count : null,
      meanSlippageR: item.count ? item.slippage / item.count : null,
      meanFundingR: item.count ? item.funding / item.count : null,
    };
  }
  return result;
}

function randomUnit(seed: number): number {
  let state = seed >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

interface Counterfactual {
  readonly long: { state: DiagnosticState; grossR: number; netR: number; feesR: number; slippageR: number; fundingR: number } | null;
  readonly short: { state: DiagnosticState; grossR: number; netR: number; feesR: number; slippageR: number; fundingR: number } | null;
}

function counterfactual(
  observation: ResearchObservation,
  points: readonly MarketDataPoint[],
  side: Side,
  feeRate: number,
  slippageRate: number,
  fundingRates: readonly BinanceFundingRate[],
): { state: DiagnosticState; grossR: number; netR: number; feesR: number; slippageR: number; fundingR: number } | null {
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
  const future = points.slice(entryIndex + 1, entryIndex + 1 + observation.horizonCandles);
  if (future.length < observation.horizonCandles) return null;
  const simulated = simulateOutcome(entry, future, {
    side,
    entryPrice: entry.close,
    targetPrice,
    invalidationPrice,
    feeRate,
    slippageRate,
  });
  if (simulated.intrabarAmbiguous) return null;
  const label: OutcomeLabel = simulated.targetHit
    ? "TARGET"
    : simulated.invalidationHit
      ? "INVALIDATION"
      : "TIME_EXIT";
  const risk = Math.abs(entry.close - invalidationPrice);
  const funding = assessFunding(side, entry.eventTime, simulated.exitEventTime, fundingRates);
  const riskFractionValue = risk / entry.close;
  const netR = (simulated.returnFraction + funding.paymentReturnFraction) / riskFractionValue;
  const grossReturnFraction = simulated.returnFraction + simulated.feeReturnFraction - simulated.slippageReturnFraction;
  const grossR = grossReturnFraction / riskFractionValue;
  return {
    state: label,
    grossR,
    netR,
    feesR: simulated.feeReturnFraction / riskFractionValue,
    slippageR: -simulated.slippageReturnFraction / riskFractionValue,
    fundingR: funding.paymentReturnFraction / riskFractionValue,
  };
}

export function buildRandomEntryStateDiagnostics(
  observations: readonly ResearchObservation[],
  points: readonly MarketDataPoint[],
  fundingRates: readonly BinanceFundingRate[],
  costs: { readonly feeRate: number; readonly slippageRate: number },
  seed: number,
  draws: number,
): Readonly<Record<DiagnosticState, RandomEntryStateDiagnostic>> {
  const counterfactuals: Counterfactual[] = [];
  for (const observation of observations) {
    const long = counterfactual(observation, points, "LONG", costs.feeRate, costs.slippageRate, fundingRates);
    const short = counterfactual(observation, points, "SHORT", costs.feeRate, costs.slippageRate, fundingRates);
    if (long !== null && short !== null) counterfactuals.push({ long, short });
  }
  const sums: Record<DiagnosticState, { count: number; gross: number; net: number; fees: number; slippage: number; funding: number }> = {
    TARGET: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
    INVALIDATION: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
    TIME_EXIT: { count: 0, gross: 0, net: 0, fees: 0, slippage: 0, funding: 0 },
  };
  for (let draw = 0; draw < draws; draw += 1) {
    const drawSeed = seed + draw;
    for (let index = 0; index < counterfactuals.length; index += 1) {
      const cf = counterfactuals[index]!;
      const selected = randomUnit(drawSeed + index * 0x9e3779b9) < 0.5 ? cf.long : cf.short;
      if (selected === null) continue;
      sums[selected.state].count += 1;
      sums[selected.state].gross += selected.grossR;
      sums[selected.state].net += selected.netR;
      sums[selected.state].fees += selected.feesR;
      sums[selected.state].slippage += selected.slippageR;
      sums[selected.state].funding += selected.fundingR;
    }
  }
  const result = emptyStateMap<RandomEntryStateDiagnostic>();
  for (const state of DIAGNOSTIC_STATES) {
    const item = sums[state];
    result[state] = {
      count: item.count,
      meanGrossR: item.count ? item.gross / item.count : null,
      meanNetR: item.count ? item.net / item.count : null,
      meanFeesR: item.count ? item.fees / item.count : null,
      meanSlippageR: item.count ? item.slippage / item.count : null,
      meanFundingR: item.count ? item.funding / item.count : null,
      draws,
      observationsAcrossDraws: item.count,
    };
  }
  return result;
}

export function buildPhase3StateDiagnostics(
  observations: readonly ResearchObservation[],
  points: readonly MarketDataPoint[],
  fundingRates: readonly BinanceFundingRate[],
  costs: { readonly feeRate: number; readonly slippageRate: number },
  seed: number,
  draws: number,
) {
  return {
    strategy: stateMeans(observations),
    randomEntry: buildRandomEntryStateDiagnostics(observations, points, fundingRates, costs, seed, draws),
  };
}
