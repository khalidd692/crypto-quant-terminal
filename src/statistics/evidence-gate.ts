import type { BinomialEstimate } from "./binomial.js";

export interface EvidenceGatePolicy {
  /** Maximum accepted Wilson interval width. */
  readonly maxProbabilityIntervalWidth: number;
  /** Required conservative probability edge over the payoff break-even rate. */
  readonly minimumLowerBoundEdge: number;
}

export interface EvidenceGateAssessment {
  readonly sufficient: boolean;
  readonly reason:
    | "NO_ESTIMATE"
    | "INVALID_POLICY"
    | "INTERVAL_TOO_WIDE"
    | "LOWER_BOUND_BELOW_BREAK_EVEN"
    | "SUFFICIENT";
  readonly intervalWidth: number | null;
  readonly lowerBound: number | null;
  readonly breakEvenProbability: number;
}

function validatePolicy(policy: EvidenceGatePolicy): void {
  if (!(policy.maxProbabilityIntervalWidth > 0 && policy.maxProbabilityIntervalWidth <= 1)) {
    throw new Error("maxProbabilityIntervalWidth must be in (0,1]");
  }
  if (!(policy.minimumLowerBoundEdge >= 0 && policy.minimumLowerBoundEdge <= 1)) {
    throw new Error("minimumLowerBoundEdge must be in [0,1]");
  }
}

function validateBreakEven(value: number): void {
  if (!(value >= 0 && value <= 1) || !Number.isFinite(value)) {
    throw new Error("breakEvenProbability must be in [0,1]");
  }
}

/**
 * Evidence is policy-driven rather than based on an arbitrary trade count.
 * The gate uses the conservative Wilson lower bound and interval width.
 */
export function assessProbabilityEvidence(
  estimate: BinomialEstimate | null,
  breakEvenProbability: number,
  policy: EvidenceGatePolicy,
): EvidenceGateAssessment {
  validatePolicy(policy);
  validateBreakEven(breakEvenProbability);

  if (estimate === null) {
    return {
      sufficient: false,
      reason: "NO_ESTIMATE",
      intervalWidth: null,
      lowerBound: null,
      breakEvenProbability,
    };
  }

  const intervalWidth = estimate.upper - estimate.lower;
  if (intervalWidth > policy.maxProbabilityIntervalWidth) {
    return {
      sufficient: false,
      reason: "INTERVAL_TOO_WIDE",
      intervalWidth,
      lowerBound: estimate.lower,
      breakEvenProbability,
    };
  }

  if (estimate.lower < breakEvenProbability + policy.minimumLowerBoundEdge) {
    return {
      sufficient: false,
      reason: "LOWER_BOUND_BELOW_BREAK_EVEN",
      intervalWidth,
      lowerBound: estimate.lower,
      breakEvenProbability,
    };
  }

  return {
    sufficient: true,
    reason: "SUFFICIENT",
    intervalWidth,
    lowerBound: estimate.lower,
    breakEvenProbability,
  };
}
