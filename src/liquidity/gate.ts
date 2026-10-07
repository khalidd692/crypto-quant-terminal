export interface LiquidityInput {
  readonly spreadBps: number | null;
  readonly estimatedSlippageBps: number | null;
  readonly depthQuote: number | null;
  readonly requiredNotionalQuote: number;
  readonly maxSpreadBps: number;
  readonly maxSlippageBps: number;
  readonly minDepthMultiple: number;
}

export interface LiquidityGateResult {
  readonly passed: boolean;
  readonly reasons: readonly string[];
  readonly stressScenario: string;
}

export function evaluateLiquidity(input: LiquidityInput): LiquidityGateResult {
  const reasons: string[] = [];
  if (input.requiredNotionalQuote <= 0) reasons.push("invalid_required_notional");
  if (input.spreadBps === null) reasons.push("missing_spread");
  else if (input.spreadBps > input.maxSpreadBps) reasons.push("spread_too_wide");
  if (input.estimatedSlippageBps === null) reasons.push("missing_slippage");
  else if (input.estimatedSlippageBps > input.maxSlippageBps) reasons.push("slippage_too_high");
  if (input.depthQuote === null) reasons.push("missing_depth");
  else if (input.depthQuote < input.requiredNotionalQuote * input.minDepthMultiple) reasons.push("insufficient_depth");

  return {
    passed: reasons.length === 0,
    reasons,
    stressScenario: `requiredNotional=${input.requiredNotionalQuote};depthMultiple=${input.minDepthMultiple}`,
  };
}
