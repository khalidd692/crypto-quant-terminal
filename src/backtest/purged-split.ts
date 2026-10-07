import type { ResearchObservation } from "../research/observation-ledger.js";

export interface ObservationSplit {
  readonly train: readonly ResearchObservation[];
  readonly test: readonly ResearchObservation[];
  readonly purged: readonly ResearchObservation[];
  readonly embargoed: readonly ResearchObservation[];
}

export interface ObservationSplitPolicy {
  readonly trainEnd: string;
  readonly testStart: string;
  readonly testEnd: string;
  readonly embargoDurationMs: number;
  readonly rationale: string;
}

function time(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp: ${value}`);
  return parsed;
}

export function splitObservations(
  observations: readonly ResearchObservation[],
  policy: ObservationSplitPolicy,
): ObservationSplit {
  if (!policy.rationale.trim()) throw new Error("Split rationale is required");
  const trainEnd = time(policy.trainEnd);
  const testStart = time(policy.testStart);
  const testEnd = time(policy.testEnd);
  if (!(trainEnd < testStart && testStart < testEnd)) throw new Error("Split periods must be strictly chronological");
  if (policy.embargoDurationMs < 0) throw new Error("Embargo duration cannot be negative");

  const embargoEnd = testEnd + policy.embargoDurationMs;
  const train: ResearchObservation[] = [];
  const test: ResearchObservation[] = [];
  const purged: ResearchObservation[] = [];
  const embargoed: ResearchObservation[] = [];

  for (const observation of observations) {
    const event = time(observation.eventTime);
    const decisionTime = time(observation.availableTime);
    const horizonEnd = observation.horizonEndTime === null ? event : time(observation.horizonEndTime);

    // The walk-forward windows are decision-time windows. A market event can
    // only enter train/test after its information snapshot is available.
    if (decisionTime >= testStart && decisionTime < testEnd) {
      test.push(observation);
      continue;
    }

    if (decisionTime < trainEnd) {
      // A label crossing into the OOS interval is not eligible training data.
      if (horizonEnd >= testStart) purged.push(observation);
      else train.push(observation);
      continue;
    }

    if (decisionTime >= testEnd && decisionTime < embargoEnd) embargoed.push(observation);
  }

  return { train, test, purged, embargoed };
}
