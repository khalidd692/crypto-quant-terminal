import type { ResearchObservation } from "../research/observation-ledger.js";
import { estimateBinomial, type BinomialEstimate } from "../statistics/binomial.js";

export interface ProbabilityCondition {
  readonly setupId: string;
  readonly side: "LONG" | "SHORT";
  readonly regimeLabel?: string;
}

export interface EmpiricalProbabilityEstimate {
  readonly event: "TARGET_BEFORE_INVALIDATION";
  readonly condition: ProbabilityCondition;
  readonly estimate: BinomialEstimate;
  readonly eligibleTrainingObservations: number;
  readonly excludedTimeExits: number;
  readonly excludedAmbiguous: number;
  readonly estimatorVersion: "empirical-conditional.v1";
  readonly trainingEnd: string;
}

function regimeFor(observation: ResearchObservation): string | null {
  return observation.regimeLabel;
}

/**
 * Estimates only from historical observations strictly before trainingEnd.
 * Time exits and intrabar-ambiguous observations are excluded from the binary
 * target-vs-invalidation event rather than silently counted as failures.
 */
export function estimateConditionalProbability(
  observations: readonly ResearchObservation[],
  condition: ProbabilityCondition,
  trainingEnd: string,
): EmpiricalProbabilityEstimate | null {
  const cutoff = Date.parse(trainingEnd);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid trainingEnd");

  const candidates = observations.filter((observation) =>
    Number.isFinite(Date.parse(observation.eventTime)) &&
    Number.isFinite(Date.parse(observation.availableTime)) &&
    Date.parse(observation.eventTime) < cutoff &&
    Date.parse(observation.availableTime) <= cutoff &&
    observation.eligible &&
    observation.outcome !== null &&
    observation.setupId === condition.setupId &&
    observation.side === condition.side &&
    (condition.regimeLabel === undefined || regimeFor(observation) === condition.regimeLabel),
  );

  const usable = candidates.filter((observation) =>
    !observation.outcome!.intrabarAmbiguous &&
    !observation.outcome!.timeExit &&
    (observation.outcome!.targetHit || observation.outcome!.invalidationHit),
  );
  if (usable.length === 0) return null;

  const successes = usable.filter((observation) => observation.outcome!.targetHit).length;
  return {
    event: "TARGET_BEFORE_INVALIDATION",
    condition,
    estimate: estimateBinomial(successes, usable.length),
    eligibleTrainingObservations: usable.length,
    excludedTimeExits: candidates.filter((observation) => observation.outcome!.timeExit).length,
    excludedAmbiguous: candidates.filter((observation) => observation.outcome!.intrabarAmbiguous).length,
    estimatorVersion: "empirical-conditional.v1",
    trainingEnd: new Date(cutoff).toISOString(),
  };
}
