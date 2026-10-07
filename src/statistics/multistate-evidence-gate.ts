import type { MultiOutcomeProbabilityEstimate } from "./multi-outcome-probability.js";

export interface MultistateEvidencePolicy {
  readonly maxTargetIntervalWidth: number;
  readonly maxAmbiguousProbability: number;
}

export interface MultistateEvidenceAssessment {
  readonly sufficient: boolean;
  readonly reason:
    | "NO_ESTIMATE"
    | "INVALID_POLICY"
    | "TARGET_INTERVAL_TOO_WIDE"
    | "AMBIGUOUS_RATE_TOO_HIGH"
    | "SUFFICIENT";
  readonly targetIntervalWidth: number | null;
  readonly targetLowerBound: number | null;
  readonly ambiguousProbability: number | null;
}

function validatePolicy(policy: MultistateEvidencePolicy): void {
  if (!(policy.maxTargetIntervalWidth > 0 && policy.maxTargetIntervalWidth <= 1)) {
    throw new Error("maxTargetIntervalWidth must be in (0,1]");
  }
  if (!(policy.maxAmbiguousProbability >= 0 && policy.maxAmbiguousProbability <= 1)) {
    throw new Error("maxAmbiguousProbability must be in [0,1]");
  }
}

export function assessMultistateEvidence(
  estimate: MultiOutcomeProbabilityEstimate | null,
  policy: MultistateEvidencePolicy,
): MultistateEvidenceAssessment {
  validatePolicy(policy);
  if (estimate === null) {
    return {
      sufficient: false,
      reason: "NO_ESTIMATE",
      targetIntervalWidth: null,
      targetLowerBound: null,
      ambiguousProbability: null,
    };
  }

  const target = estimate.probabilities.find((item) => item.event === "TARGET");
  const ambiguous = estimate.probabilities.find((item) => item.event === "AMBIGUOUS");
  if (!target || !ambiguous) throw new Error("Multistate estimate is missing required outcome labels");

  const targetIntervalWidth = target.uncertainty.interval.upper - target.uncertainty.interval.lower;
  if (targetIntervalWidth > policy.maxTargetIntervalWidth) {
    return {
      sufficient: false,
      reason: "TARGET_INTERVAL_TOO_WIDE",
      targetIntervalWidth,
      targetLowerBound: target.uncertainty.interval.lower,
      ambiguousProbability: ambiguous.probability,
    };
  }
  if (ambiguous.probability > policy.maxAmbiguousProbability) {
    return {
      sufficient: false,
      reason: "AMBIGUOUS_RATE_TOO_HIGH",
      targetIntervalWidth,
      targetLowerBound: target.uncertainty.interval.lower,
      ambiguousProbability: ambiguous.probability,
    };
  }
  return {
    sufficient: true,
    reason: "SUFFICIENT",
    targetIntervalWidth,
    targetLowerBound: target.uncertainty.interval.lower,
    ambiguousProbability: ambiguous.probability,
  };
}
