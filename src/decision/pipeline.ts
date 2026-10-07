import type { Expectancy, LiquidityAssessment, RiskSnapshot, Signal, Side } from "../domain/types.js";
import { assessProbabilityEvidence, type EvidenceGatePolicy } from "../statistics/evidence-gate.js";
import type { BinomialEstimate } from "../statistics/binomial.js";
import { calculateNetExpectancy, type OutcomeProbability } from "../statistics/expectancy.js";
import { evaluateHardVetoes } from "./veto.js";

export interface DecisionPipelineInput {
  readonly side: Side | null;
  readonly probabilityEstimate: BinomialEstimate | null;
  readonly breakEvenProbability: number;
  readonly evidencePolicy: EvidenceGatePolicy;
  readonly outcomePayoffsR: readonly { readonly probability: number; readonly payoffR: number; readonly event: string }[];
  readonly feesR: number;
  readonly slippageR: number;
  readonly fundingR: number;
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
  const evidence = assessProbabilityEvidence(input.probabilityEstimate, input.breakEvenProbability, input.evidencePolicy);

  let expectancy: Expectancy | null = null;
  if (input.outcomePayoffsR.length > 0) {
    const outcomes: OutcomeProbability[] = input.outcomePayoffsR.map((item) => ({
      event: item.event,
      probability: item.probability,
      payoffR: item.payoffR,
    }));
    const net = calculateNetExpectancy(outcomes, input.feesR, input.slippageR, input.fundingR);
    expectancy = {
      expectedValue: net.netR,
      unit: "R",
      gross: net.grossR,
      fees: net.feesR,
      slippage: net.slippageR,
      funding: net.fundingR,
      methodologyVersion: "expectancy.v2",
    };
  }

  const veto = evaluateHardVetoes({
    dataValid: input.dataValid,
    dataFresh: input.dataFresh,
    evidenceSufficient: evidence.sufficient,
    expectancyNetR: expectancy?.expectedValue ?? null,
    minExpectedValueR: input.minExpectedValueR,
    liquidityPassed: input.liquidityPassed,
    portfolioRiskAllowed: input.portfolioRiskAllowed,
    invalidationDefined: input.invalidationDefined,
  });

  if (!evidence.sufficient) return { decision: "INSUFFICIENT_EVIDENCE", side: null, evidenceSufficient: false, expectancy, vetoReasons: veto.reasons };
  if (veto.vetoed) return { decision: "NO_TRADE", side: null, evidenceSufficient: true, expectancy, vetoReasons: veto.reasons };
  if (input.side === null) return { decision: "WAIT", side: null, evidenceSufficient: true, expectancy, vetoReasons: ["no_directional_setup"] };
  return { decision: input.side, side: input.side, evidenceSufficient: true, expectancy, vetoReasons: [] };
}

function sideOrNull(side: Side | null): Side | null { return side; }
