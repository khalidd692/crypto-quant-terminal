import { estimateBinomial, type BinomialEstimate } from "./binomial.js";

export interface BinaryObservation {
  readonly key: string;
  readonly success: boolean;
  readonly observedAt: string;
}

export interface EmpiricalEdge {
  readonly key: string;
  readonly estimate: BinomialEstimate;
  readonly observationCount: number;
}

export function estimateEmpiricalEdge(observations: readonly BinaryObservation[], key: string): EmpiricalEdge | null {
  const subset = observations.filter((observation) => observation.key === key);
  if (subset.length === 0) return null;
  const successes = subset.filter((observation) => observation.success).length;
  const estimate = estimateBinomial(successes, subset.length);
  return { key, estimate, observationCount: subset.length };
}
