import type { Decision, Expectancy, LiquidityAssessment, RiskSnapshot, Side } from "../domain/types.js";

export interface DecisionInput {
  readonly directionalSide: Side | null;
  readonly evidenceSufficient: boolean;
  readonly expectancy: Expectancy | null;
  readonly minExpectedValue: number;
  readonly liquidity: LiquidityAssessment | null;
  readonly risk: RiskSnapshot | null;
  readonly vetoReasons: readonly string[];
}

export interface DecisionResult {
  readonly decision: Decision;
  readonly side: Side | null;
  readonly reasons: readonly string[];
}

export function decide(input: DecisionInput): DecisionResult {
  const reasons = [...input.vetoReasons];

  if (!input.evidenceSufficient) return { decision: "INSUFFICIENT_EVIDENCE", side: null, reasons: ["insufficient_evidence", ...reasons] };
  if (reasons.length > 0) return { decision: "NO_TRADE", side: null, reasons };
  if (input.liquidity === null || !input.liquidity.passed) return { decision: "NO_TRADE", side: null, reasons: ["liquidity_gate_failed", ...reasons] };
  if (input.risk === null) return { decision: "NO_TRADE", side: null, reasons: ["risk_snapshot_missing", ...reasons] };
  if (input.expectancy === null) return { decision: "WAIT", side: null, reasons: ["expectancy_missing"] };
  if (input.expectancy.expectedValue < input.minExpectedValue) {
    return { decision: "WAIT", side: null, reasons: ["expectancy_below_threshold"] };
  }
  if (input.directionalSide === null) return { decision: "WAIT", side: null, reasons: ["no_directional_setup"] };

  return { decision: input.directionalSide, side: input.directionalSide, reasons: [] };
}
