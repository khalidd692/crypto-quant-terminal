import type { ResearchObservation } from "./observation-ledger.js";
import { estimateBinomial } from "../statistics/binomial.js";

export interface ResearchMetrics {
  readonly totalObservations: number;
  readonly eligibleObservations: number;
  readonly excludedObservations: number;
  readonly ambiguousObservations: number;
  readonly longObservations: number;
  readonly shortObservations: number;
  readonly targetHits: number;
  readonly invalidationHits: number;
  readonly timeExits: number;
  readonly targetProbability: ReturnType<typeof estimateBinomial> | null;
  readonly meanRealizedR: number | null;
  readonly medianRealizedR: number | null;
  readonly meanMfeR: number | null;
  readonly meanMaeR: number | null;
  readonly cumulativeR: number;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] ?? null : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function calculateResearchMetrics(observations: readonly ResearchObservation[]): ResearchMetrics {
  const eligible = observations.filter((o) => o.eligible && o.outcome !== null);
  const clean = eligible.filter((o) => !o.outcome?.intrabarAmbiguous);
  const r = clean.map((o) => o.outcome?.realizedR ?? 0);
  const mfe = clean.map((o) => o.outcome?.mfeR ?? 0);
  const mae = clean.map((o) => o.outcome?.maeR ?? 0);
  const targets = clean.filter((o) => o.outcome?.targetHit).length;
  const mean = (xs: readonly number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  return {
    totalObservations: observations.length,
    eligibleObservations: eligible.length,
    excludedObservations: observations.length - eligible.length,
    ambiguousObservations: eligible.length - clean.length,
    longObservations: clean.filter((o) => o.side === "LONG").length,
    shortObservations: clean.filter((o) => o.side === "SHORT").length,
    targetHits: targets,
    invalidationHits: clean.filter((o) => o.outcome?.invalidationHit).length,
    timeExits: clean.filter((o) => o.outcome?.timeExit).length,
    targetProbability: clean.length ? estimateBinomial(targets, clean.length) : null,
    meanRealizedR: mean(r),
    medianRealizedR: median(r),
    meanMfeR: mean(mfe),
    meanMaeR: mean(mae),
    cumulativeR: r.reduce((a, b) => a + b, 0),
  };
}
