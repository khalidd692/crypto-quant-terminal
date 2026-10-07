import type { PortfolioSnapshot, Side } from "../domain/types.js";

export interface PortfolioRiskInput {
  readonly portfolio: PortfolioSnapshot;
  readonly instrumentId: string;
  readonly side: Side;
  readonly notionalQuote: number;
  readonly incrementalRiskQuote: number;
  readonly maxPortfolioRiskQuote: number;
}

export interface PortfolioRiskResult {
  readonly allowed: boolean;
  readonly projectedRiskQuote: number;
  readonly reason: string | null;
}

export function evaluatePortfolioRisk(input: PortfolioRiskInput): PortfolioRiskResult {
  if (input.notionalQuote < 0 || input.incrementalRiskQuote < 0) {
    throw new Error("Exposure and incremental risk cannot be negative");
  }
  const projectedRiskQuote = input.portfolio.riskQuote + input.incrementalRiskQuote;
  if (projectedRiskQuote > input.maxPortfolioRiskQuote) {
    return { allowed: false, projectedRiskQuote, reason: "portfolio_risk_limit" };
  }
  return { allowed: true, projectedRiskQuote, reason: null };
}
