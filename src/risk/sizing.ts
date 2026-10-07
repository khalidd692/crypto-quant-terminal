export interface PositionRiskInput {
  readonly equityQuote: number;
  readonly maxRiskFraction: number;
  readonly entryPrice: number;
  readonly invalidationPrice: number;
  readonly contractMultiplier?: number;
  readonly leverage: number;
  readonly existingPortfolioRiskQuote: number;
  readonly portfolioRiskLimitQuote: number;
}

export interface PositionRiskAssessment {
  readonly allowed: boolean;
  readonly riskPerUnitQuote: number;
  readonly maxLossQuote: number;
  readonly positionNotionalQuote: number;
  readonly quantity: number;
  readonly leverage: number;
  readonly portfolioRiskBefore: number;
  readonly portfolioRiskAfter: number;
  readonly reason: string | null;
  readonly methodologyVersion: "risk-sizing.v2";
}

export function assessPositionRisk(input: PositionRiskInput): PositionRiskAssessment {
  if (!(input.equityQuote > 0)) throw new Error("equityQuote must be positive");
  if (!(input.maxRiskFraction > 0 && input.maxRiskFraction <= 1)) throw new Error("maxRiskFraction must be in (0,1]");
  if (!(input.entryPrice > 0) || !(input.invalidationPrice > 0)) throw new Error("Prices must be positive");
  if (!(input.leverage > 0)) throw new Error("leverage must be positive");
  if (input.existingPortfolioRiskQuote < 0 || input.portfolioRiskLimitQuote <= 0) throw new Error("Invalid portfolio risk");
  const multiplier = input.contractMultiplier ?? 1;
  if (!(multiplier > 0)) throw new Error("contractMultiplier must be positive");

  const riskPerUnitQuote = Math.abs(input.entryPrice - input.invalidationPrice) * multiplier;
  const riskBudgetQuote = input.equityQuote * input.maxRiskFraction;
  const riskBasedQuantity = riskPerUnitQuote === 0 ? 0 : riskBudgetQuote / riskPerUnitQuote;
  const maxNotionalQuote = input.equityQuote * input.leverage;
  const leverageCappedQuantity = maxNotionalQuote / (input.entryPrice * multiplier);
  const quantity = Math.min(riskBasedQuantity, leverageCappedQuantity);
  const maxLossQuote = quantity * riskPerUnitQuote;
  const positionNotionalQuote = quantity * input.entryPrice * multiplier;
  const portfolioRiskAfter = input.existingPortfolioRiskQuote + maxLossQuote;
  const allowed = riskPerUnitQuote > 0 && quantity > 0 && portfolioRiskAfter <= input.portfolioRiskLimitQuote;
  return {
    allowed,
    riskPerUnitQuote,
    maxLossQuote,
    positionNotionalQuote,
    quantity,
    leverage: input.leverage,
    portfolioRiskBefore: input.existingPortfolioRiskQuote,
    portfolioRiskAfter,
    reason: allowed ? null : (riskPerUnitQuote === 0 ? "invalidation_distance_zero" : "portfolio_risk_limit"),
    methodologyVersion: "risk-sizing.v2",
  };
}


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
