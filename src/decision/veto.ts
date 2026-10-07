export interface VetoContext {
  readonly dataValid: boolean;
  readonly dataFresh: boolean;
  readonly liquidityPassed: boolean;
  readonly portfolioRiskAllowed: boolean;
  readonly invalidationDefined: boolean;
}

export interface VetoResult {
  readonly vetoed: boolean;
  readonly reasons: readonly string[];
}

export function evaluateHardVetoes(context: VetoContext): VetoResult {
  const reasons: string[] = [];
  if (!context.dataValid) reasons.push("data_invalid");
  if (!context.dataFresh) reasons.push("data_stale");
  if (!context.liquidityPassed) reasons.push("liquidity_gate_failed");
  if (!context.portfolioRiskAllowed) reasons.push("portfolio_risk_limit");
  if (!context.invalidationDefined) reasons.push("invalidation_missing");
  return { vetoed: reasons.length > 0, reasons };
}
