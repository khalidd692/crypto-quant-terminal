export interface PositionSizingInput {
  readonly equityQuote: number;
  readonly maxRiskFraction: number;
  readonly entryPrice: number;
  readonly invalidationPrice: number;
  readonly contractMultiplier: number;
  readonly maxLeverage: number;
  readonly availableLiquidityQuote: number;
}

export interface PositionSizingResult {
  readonly riskBudgetQuote: number;
  readonly distancePerUnit: number;
  readonly rawUnits: number;
  readonly cappedUnits: number;
  readonly notionalQuote: number;
  readonly effectiveLeverage: number;
}

export function calculatePositionSize(input: PositionSizingInput): PositionSizingResult {
  if (input.equityQuote <= 0) throw new Error("equityQuote must be positive");
  if (input.maxRiskFraction <= 0 || input.maxRiskFraction > 1) throw new Error("maxRiskFraction must be in (0,1]");
  if (input.entryPrice <= 0 || input.invalidationPrice <= 0) throw new Error("Prices must be positive");
  if (input.contractMultiplier <= 0) throw new Error("contractMultiplier must be positive");
  if (input.maxLeverage < 0) throw new Error("maxLeverage cannot be negative");

  const distancePerUnit = Math.abs(input.entryPrice - input.invalidationPrice) * input.contractMultiplier;
  if (distancePerUnit === 0) throw new Error("Invalidation distance cannot be zero");

  const riskBudgetQuote = input.equityQuote * input.maxRiskFraction;
  const rawUnits = riskBudgetQuote / distancePerUnit;
  const leverageCapUnits = (input.equityQuote * input.maxLeverage) / (input.entryPrice * input.contractMultiplier);
  const liquidityCapUnits = input.availableLiquidityQuote / (input.entryPrice * input.contractMultiplier);
  const cappedUnits = Math.max(0, Math.min(rawUnits, leverageCapUnits, liquidityCapUnits));
  const notionalQuote = cappedUnits * input.entryPrice * input.contractMultiplier;
  const effectiveLeverage = input.equityQuote === 0 ? 0 : notionalQuote / input.equityQuote;

  return { riskBudgetQuote, distancePerUnit, rawUnits, cappedUnits, notionalQuote, effectiveLeverage };
}
