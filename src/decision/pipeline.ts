import type { Expectancy, Signal, Side } from "../domain/types.js";
import { assessMultistateEvidence, type MultistateEvidencePolicy } from "../statistics/multistate-evidence-gate.js";
import type { MultiOutcomeProbabilityEstimate } from "../statistics/multi-outcome-probability.js";
import { evaluateHardVetoes } from "./veto.js";

export interface DecisionPipelineInput {
  readonly side: Side | null;
  readonly outcomeDistribution: MultiOutcomeProbabilityEstimate | null;
  readonly evidencePolicy: MultistateEvidencePolicy;
  readonly minExpectedValueR: number;
  readonly dataValid: boolean;
  readonly dataFresh: boolean;
  readonly liquidityPassed: boolean;
  readonly portfolioRiskAllowed: boolean;
  readonly invalidationDefined: boolean;
}

export interface DecisionPipelineResult {
  readonly decision: Signal["decision"];
  readonly side: Side | null;
  readonly evidenceSufficient: boolean;
  readonly expectancy: Expectancy | null;
  readonly vetoReasons: readonly string[];
}

export function evaluateDecisionPipeline(input: DecisionPipelineInput): DecisionPipelineResult {
  const evidence = assessMultistateEvidence(input.outcomeDistribution, input.evidencePolicy);

  const expectancy: Expectancy | null = input.outcomeDistribution
    ? {
        expectedValue: input.outcomeDistribution.expectancy.expectedValueR,
        unit: "R",
        gross: input.outcomeDistribution.expectancy.grossR,
        fees: input.outcomeDistribution.expectancy.feesR,
        slippage: input.outcomeDistribution.expectancy.slippageR,
        funding: input.outcomeDistribution.expectancy.fundingR,
        methodologyVersion: input.outcomeDistribution.expectancy.methodologyVersion,
      }
    : null;

  const veto = evaluateHardVetoes({
    dataValid: input.dataValid,
    dataFresh: input.dataFresh,
    liquidityPassed: input.liquidityPassed,
    portfolioRiskAllowed: input.portfolioRiskAllowed,
    invalidationDefined: input.invalidationDefined,
  });

  if (veto.vetoed) {
    return { decision: "NO_TRADE", side: null, evidenceSufficient: evidence.sufficient, expectancy, vetoReasons: veto.reasons };
  }
  if (!evidence.sufficient) {
    return { decision: "INSUFFICIENT_EVIDENCE", side: null, evidenceSufficient: false, expectancy, vetoReasons: [evidence.reason] };
  }
  if (expectancy === null) {
    return { decision: "WAIT", side: null, evidenceSufficient: true, expectancy, vetoReasons: ["expectancy_missing"] };
  }
  if (expectancy.expectedValue < input.minExpectedValueR) {
    return { decision: "WAIT", side: null, evidenceSufficient: true, expectancy, vetoReasons: ["expectancy_below_threshold"] };
  }
  if (input.side === null) {
    return { decision: "WAIT", side: null, evidenceSufficient: true, expectancy, vetoReasons: ["no_directional_setup"] };
  }
  return { decision: input.side, side: input.side, evidenceSufficient: true, expectancy, vetoReasons: [] };
}
