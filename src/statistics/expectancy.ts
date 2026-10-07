import { assertProbability, estimateBinomial, type BinomialEstimate } from "./binomial.js";

export interface OutcomeProbability {
  readonly event: string;
  readonly probability: number;
  readonly payoffR: number;
}

export interface NetExpectancy {
  readonly grossR: number;
  readonly feesR: number;
  readonly slippageR: number;
  readonly fundingR: number;
  readonly netR: number;
}

export interface BinaryExpectancy {
  readonly estimate: BinomialEstimate;
  readonly breakEvenProbability: number;
  readonly expectedValueR: number;
  readonly conservativeExpectedValueR: number;
}

export function calculateNetExpectancy(
  outcomes: readonly OutcomeProbability[],
  feesR: number,
  slippageR: number,
  fundingR: number,
): NetExpectancy {
  if (outcomes.length === 0) throw new Error("At least one outcome is required");
  if (feesR < 0 || slippageR < 0) throw new Error("Fees and slippage cannot be negative");

  const total = outcomes.reduce((sum, outcome) => {
    assertProbability(outcome.probability);
    if (!Number.isFinite(outcome.payoffR)) throw new Error("Payoff must be finite");
    return sum + outcome.probability;
  }, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error("Outcome probabilities must sum to 1");

  const grossR = outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.payoffR, 0);
  return {
    grossR,
    feesR,
    slippageR,
    fundingR,
    netR: grossR - feesR - slippageR - fundingR,
  };
}

export function calculateBinaryExpectancy(
  successes: number,
  observations: number,
  winR: number,
  lossR: number,
  totalCostR: number,
): BinaryExpectancy {
  if (winR <= 0 || lossR <= 0) throw new Error("winR and lossR must be positive");
  if (totalCostR < 0) throw new Error("totalCostR cannot be negative");

  const estimate = estimateBinomial(successes, observations);
  const breakEvenProbability = (lossR + totalCostR) / (winR + lossR);
  const expectedValueR = estimate.probability * winR - (1 - estimate.probability) * lossR - totalCostR;
  const conservativeExpectedValueR =
    estimate.interval.lower * winR - (1 - estimate.interval.lower) * lossR - totalCostR;

  return { estimate, breakEvenProbability, expectedValueR, conservativeExpectedValueR };
}
