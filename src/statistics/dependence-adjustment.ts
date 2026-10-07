import type { ResearchObservation } from "../research/observation-ledger.js";
import { estimateBinomial, type BinomialEstimate } from "./binomial.js";

export interface NonOverlappingSample {
  readonly observations: readonly ResearchObservation[];
  readonly sampleSize: number;
  readonly sourceSampleSize: number;
  readonly selectionMethod: "greedy-horizon-non-overlap";
}

export function selectNonOverlappingObservations(
  observations: readonly ResearchObservation[],
): NonOverlappingSample {
  const ordered = [...observations]
    .filter((observation) => {
      const event = Date.parse(observation.eventTime);
      const end = observation.horizonEndTime === null ? NaN : Date.parse(observation.horizonEndTime);
      return Number.isFinite(event) && Number.isFinite(end) && end > event;
    })
    .sort((a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime));

  const selected: ResearchObservation[] = [];
  let nextAvailableEventTime = -Infinity;
  for (const observation of ordered) {
    const eventTime = Date.parse(observation.eventTime);
    const horizonEndTime = Date.parse(observation.horizonEndTime!);
    if (eventTime < nextAvailableEventTime) continue;
    selected.push(observation);
    nextAvailableEventTime = horizonEndTime;
  }

  return {
    observations: selected,
    sampleSize: selected.length,
    sourceSampleSize: observations.length,
    selectionMethod: "greedy-horizon-non-overlap",
  };
}

export interface DependenceAdjustedBinomial {
  readonly naive: BinomialEstimate;
  readonly adjusted: BinomialEstimate;
  readonly effectiveSampleSize: number;
  readonly selectionMethod: NonOverlappingSample["selectionMethod"];
}

export function estimateDependenceAdjustedBinomial(
  observations: readonly ResearchObservation[],
  isSuccess: (observation: ResearchObservation) => boolean,
): DependenceAdjustedBinomial | null {
  if (!observations.length) return null;
  const naiveSuccesses = observations.filter(isSuccess).length;
  const sample = selectNonOverlappingObservations(observations);
  if (!sample.sampleSize) return null;
  const adjustedSuccesses = sample.observations.filter(isSuccess).length;
  return {
    naive: estimateBinomial(naiveSuccesses, observations.length),
    adjusted: estimateBinomial(adjustedSuccesses, sample.sampleSize),
    effectiveSampleSize: sample.sampleSize,
    selectionMethod: sample.selectionMethod,
  };
}
