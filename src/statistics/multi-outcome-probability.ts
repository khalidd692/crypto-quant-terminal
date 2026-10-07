import type { OutcomeLabel } from "../research/observation-ledger.js";
import type { ResearchObservation } from "../research/observation-ledger.js";
import { estimateBinomial, type BinomialEstimate } from "./binomial.js";

export type EmpiricalOutcomeEvent = OutcomeLabel;

export interface OutcomeProbability {
  readonly event: EmpiricalOutcomeEvent;
  readonly probability: number;
  readonly count: number;
  readonly uncertainty: BinomialEstimate;
}

export interface MultiOutcomeProbabilityEstimate {
  readonly probabilities: readonly OutcomeProbability[];
  readonly sampleSize: number;
  readonly condition: {
    readonly setupId: string;
    readonly side: "LONG" | "SHORT";
  };
  readonly trainingEnd: string;
  readonly estimatorVersion: "empirical-multinomial.v1";
}

/**
 * Estimates the complete observed outcome distribution. Unlike the binary
 * target-vs-invalidation estimator, TIME_EXIT and AMBIGUOUS remain in the
 * probability space instead of being discarded.
 *
 * The four event probabilities therefore sum exactly to 1 over usable labels.
 * Wilson intervals are reported per category as binomial marginal intervals;
 * they are not independent confidence intervals for the whole multinomial.
 */
export function estimateOutcomeDistribution(
  observations: readonly ResearchObservation[],
  condition: { readonly setupId: string; readonly side: "LONG" | "SHORT" },
  trainingEnd: string,
): MultiOutcomeProbabilityEstimate | null {
  const cutoff = Date.parse(trainingEnd);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid trainingEnd");

  const candidates = observations.filter((observation) =>
    observation.eligible &&
    observation.outcome !== null &&
    observation.setupId === condition.setupId &&
    observation.side === condition.side &&
    Number.isFinite(Date.parse(observation.eventTime)) &&
    Number.isFinite(Date.parse(observation.availableTime)) &&
    Date.parse(observation.eventTime) < cutoff &&
    Date.parse(observation.availableTime) <= cutoff,
  );

  if (!candidates.length) return null;

  const labels: readonly OutcomeLabel[] = ["TARGET", "INVALIDATION", "TIME_EXIT", "AMBIGUOUS"];
  const probabilities = labels.map((event) => {
    const count = candidates.filter((observation) => observation.outcome!.label === event).length;
    return {
      event,
      probability: count / candidates.length,
      count,
      uncertainty: estimateBinomial(count, candidates.length),
    };
  });

  return {
    probabilities,
    sampleSize: candidates.length,
    condition,
    trainingEnd: new Date(cutoff).toISOString(),
    estimatorVersion: "empirical-multinomial.v1",
  };
}
