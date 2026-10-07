import type { ResearchObservation } from "./observation-ledger.js";
import { estimateBinomial } from "../statistics/binomial.js";

export interface ReturnSummary {
  readonly count: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly sum: number;
  readonly positiveFraction: number | null;
  readonly max: number | null;
  readonly min: number | null;
}

export interface DrawdownSummary {
  readonly maxDrawdownR: number;
  readonly maxDrawdownFraction: number;
  readonly peakIndex: number | null;
  readonly troughIndex: number | null;
}

export interface ResearchReport {
  readonly totalObservations: number;
  readonly cleanEligibleObservations: number;
  readonly ambiguousObservations: number;
  readonly long: ReturnSummary;
  readonly short: ReturnSummary;
  readonly all: ReturnSummary;
  readonly targetHitRate: ReturnType<typeof estimateBinomial> | null;
  readonly invalidationHitRate: ReturnType<typeof estimateBinomial> | null;
  readonly drawdown: DrawdownSummary;
}

function summary(values: readonly number[]): ReturnSummary {
  if (!values.length) return { count: 0, mean: null, median: null, sum: 0, positiveFraction: null, max: null, min: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle]! : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    mean: sum / values.length,
    median,
    sum,
    positiveFraction: values.filter((value) => value > 0).length / values.length,
    max: sorted.at(-1) ?? null,
    min: sorted[0] ?? null,
  };
}

function drawdown(values: readonly number[]): DrawdownSummary {
  let equity = 0;
  let runningPeakEquity = 0;
  let peakIndex: number | null = null;
  let troughIndex: number | null = null;
  let maxDrawdownR = 0;
  let maxDrawdownFraction = 0;

  values.forEach((value, index) => {
    equity += value;
    if (equity > runningPeakEquity) {
      runningPeakEquity = equity;
      peakIndex = index;
    }
    const dd = equity - runningPeakEquity;
    if (dd < maxDrawdownR) {
      maxDrawdownR = dd;
      troughIndex = index;
      maxDrawdownFraction = dd / Math.max(1, Math.abs(runningPeakEquity));
    }
  });
  return { maxDrawdownR, maxDrawdownFraction, peakIndex, troughIndex };
}

export function buildResearchReport(observations: readonly ResearchObservation[]): ResearchReport {
  const clean = observations.filter((observation) =>
    observation.eligible && observation.outcome !== null && !observation.outcome.intrabarAmbiguous,
  );
  const allReturns = clean.map((observation) => observation.outcome!.realizedR);
  const longReturns = clean.filter((observation) => observation.side === "LONG").map((observation) => observation.outcome!.realizedR);
  const shortReturns = clean.filter((observation) => observation.side === "SHORT").map((observation) => observation.outcome!.realizedR);
  const targets = clean.filter((observation) => observation.outcome!.targetHit).length;
  const invalidations = clean.filter((observation) => observation.outcome!.invalidationHit).length;

  return {
    totalObservations: observations.length,
    cleanEligibleObservations: clean.length,
    ambiguousObservations: observations.filter((observation) => observation.outcome?.intrabarAmbiguous).length,
    long: summary(longReturns),
    short: summary(shortReturns),
    all: summary(allReturns),
    targetHitRate: clean.length ? estimateBinomial(targets, clean.length) : null,
    invalidationHitRate: clean.length ? estimateBinomial(invalidations, clean.length) : null,
    drawdown: drawdown(allReturns),
  };
}
