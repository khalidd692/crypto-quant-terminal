import type { ResearchObservation } from "../research/observation-ledger.js";
import { estimateOutcomeDistribution, type MultiOutcomeProbabilityEstimate } from "../statistics/multi-outcome-probability.js";
import { BASELINE_SETUP_ID } from "../setup/basic.js";

export interface FrozenTerminalEstimator {
  readonly modelVersion: "empirical-terminal.v1";
  readonly trainingEnd: string;
  readonly predict: (
    side: "LONG" | "SHORT",
  ) => MultiOutcomeProbabilityEstimate | null;
}

export function trainFrozenTerminalEstimator(
  trainingObservations: readonly ResearchObservation[],
  trainingEnd: string,
): FrozenTerminalEstimator {
  const estimates = new Map<"LONG" | "SHORT", MultiOutcomeProbabilityEstimate | null>();
  for (const side of ["LONG", "SHORT"] as const) {
    estimates.set(
      side,
      estimateOutcomeDistribution(
        trainingObservations,
        { setupId: BASELINE_SETUP_ID, side },
        trainingEnd,
      ),
    );
  }
  return {
    modelVersion: "empirical-terminal.v1",
    trainingEnd,
    predict: (side) => estimates.get(side) ?? null,
  };
}
