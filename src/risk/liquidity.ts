export interface LiquidityInput {
  readonly spreadBps: number;
  readonly estimatedSlippageBps: number;
  readonly depthQuote: number;
  readonly orderNotionalQuote: number;
  readonly maxSpreadBps: number;
  readonly maxSlippageBps: number;
  readonly minDepthMultiple: number;
}

export interface LiquidityGate {
  readonly passed: boolean;
  readonly spreadBps: number;
  readonly estimatedSlippageBps: number;
  readonly depthQuote: number;
  readonly stressScenario: string;
  readonly methodologyVersion: "liquidity-gate.v1";
  readonly reason: string | null;
}

export function assessLiquidity(input: LiquidityInput): LiquidityGate {
  if (
    ![input.spreadBps, input.estimatedSlippageBps, input.depthQuote, input.orderNotionalQuote].every(
      Number.isFinite,
    )
  ) {
    throw new Error("Liquidity inputs must be finite");
  }
  if (input.orderNotionalQuote <= 0 || input.depthQuote < 0) throw new Error("Invalid liquidity sizes");
  if (input.maxSpreadBps < 0 || input.maxSlippageBps < 0 || input.minDepthMultiple <= 0) {
    throw new Error("Invalid liquidity policy");
  }
  const passed =
    input.spreadBps <= input.maxSpreadBps &&
    input.estimatedSlippageBps <= input.maxSlippageBps &&
    input.depthQuote >= input.orderNotionalQuote * input.minDepthMultiple;
  let reason: string | null = null;
  if (input.spreadBps > input.maxSpreadBps) reason = "spread_too_wide";
  else if (input.estimatedSlippageBps > input.maxSlippageBps) reason = "slippage_too_high";
  else if (input.depthQuote < input.orderNotionalQuote * input.minDepthMultiple)
    reason = "insufficient_depth";
  return {
    passed,
    spreadBps: input.spreadBps,
    estimatedSlippageBps: input.estimatedSlippageBps,
    depthQuote: input.depthQuote,
    stressScenario: `depth>=${input.minDepthMultiple}x_order_notional`,
    methodologyVersion: "liquidity-gate.v1",
    reason,
  };
}
