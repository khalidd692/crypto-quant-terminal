import type {
  Expectancy,
  Invalidation,
  LiquidityAssessment,
  ProbabilityEstimate,
  RiskSnapshot,
  Signal,
  UncertaintyEstimate,
} from "./types.js";

export function assertProbability(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Probability must be within [0, 1]: ${value}`);
  }
}

export function assertProbabilityEstimate(value: ProbabilityEstimate): void {
  assertProbability(value.probability);
  if (!Number.isInteger(value.sampleSize) || value.sampleSize < 0) {
    throw new Error("Probability sampleSize must be a non-negative integer");
  }
}

export function assertUncertainty(value: UncertaintyEstimate): void {
  if (value.lower !== null) assertProbability(value.lower);
  if (value.upper !== null) assertProbability(value.upper);
  if (value.lower !== null && value.upper !== null && value.lower > value.upper) {
    throw new Error("Uncertainty lower bound cannot exceed upper bound");
  }
  if (value.level !== null) assertProbability(value.level);
}

export function assertExpectancy(value: Expectancy): void {
  for (const [name, amount] of Object.entries({
    expectedValue: value.expectedValue,
    gross: value.gross,
    fees: value.fees,
    slippage: value.slippage,
    funding: value.funding,
  })) {
    if (!Number.isFinite(amount)) throw new Error(`Expectancy ${name} must be finite`);
  }
}

export function assertInvalidation(value: Invalidation): void {
  if (!value.rationale.trim()) throw new Error("Invalidation requires a rationale");
  if (value.type === "price" && (value.level === undefined || !Number.isFinite(value.level))) {
    throw new Error("Price invalidation requires a finite level");
  }
}

export function assertRisk(value: RiskSnapshot): void {
  if (!Number.isFinite(value.maxLossQuote) || value.maxLossQuote < 0) {
    throw new Error("maxLossQuote must be non-negative and finite");
  }
  if (!Number.isFinite(value.leverage) || value.leverage < 0) {
    throw new Error("leverage must be non-negative and finite");
  }
  if (value.portfolioRiskBefore < 0 || value.portfolioRiskAfter < 0) {
    throw new Error("Portfolio risk cannot be negative");
  }
}

export function assertLiquidity(value: LiquidityAssessment): void {
  if (value.passed && value.stressScenario.trim() === "") {
    throw new Error("Passed liquidity assessment requires a stress scenario");
  }
}

export function assertSignal(signal: Signal): void {
  for (const probability of signal.probabilities) assertProbabilityEstimate(probability);
  for (const uncertainty of signal.uncertainty) assertUncertainty(uncertainty);
  if (signal.expectancy) assertExpectancy(signal.expectancy);
  if (signal.invalidation) assertInvalidation(signal.invalidation);
  if (signal.risk) assertRisk(signal.risk);
  if (signal.liquidity) assertLiquidity(signal.liquidity);

  if ((signal.decision === "LONG" || signal.decision === "SHORT") && signal.side === null) {
    throw new Error("Directional decision requires a side");
  }
  if (signal.decision === "NO_TRADE" && signal.vetoReasons.length === 0) {
    throw new Error("NO_TRADE requires at least one veto reason");
  }
  if (signal.decision === "INSUFFICIENT_EVIDENCE" && signal.probabilities.length > 0) {
    throw new Error("INSUFFICIENT_EVIDENCE must not pretend to have a validated probability estimate");
  }
  if (signal.liquidity && !signal.liquidity.passed && signal.decision !== "NO_TRADE") {
    throw new Error("Failed liquidity gate requires NO_TRADE");
  }
}
