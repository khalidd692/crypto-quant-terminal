import type { MarketDataPoint, Side } from "../domain/types.js";

export interface OutcomeScenario {
  readonly side: Side;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly invalidationPrice: number;
  readonly feeRate: number;
  readonly slippageRate: number;
}

export interface SimulatedOutcome {
  readonly returnFraction: number;
  /** MFE is non-negative R. */
  readonly mfeR: number;
  /** MAE is non-positive R. */
  readonly maeR: number;
  readonly targetHit: boolean;
  readonly invalidationHit: boolean;
  readonly intrabarAmbiguous: boolean;
  readonly exitPrice: number;
  readonly exitEventTime: string;
  readonly exitCandleIndex: number;
  readonly grossReturnFraction: number;
  readonly feeReturnFraction: number;
  readonly slippageReturnFraction: number;
}

function applyEntrySlippage(price: number, side: Side, rate: number): number {
  return side === "LONG" ? price * (1 + rate) : price * (1 - rate);
}

function applyExitSlippage(price: number, side: Side, rate: number): number {
  return side === "LONG" ? price * (1 - rate) : price * (1 + rate);
}

function directionalReturn(entry: number, exit: number, side: Side): number {
  return side === "LONG" ? (exit - entry) / entry : (entry - exit) / entry;
}

export function simulateOutcome(
  entry: MarketDataPoint,
  future: readonly MarketDataPoint[],
  scenario: OutcomeScenario,
): SimulatedOutcome {
  const entryPrice = applyEntrySlippage(scenario.entryPrice, scenario.side, scenario.slippageRate);
  const riskPerUnit = Math.abs(entryPrice - scenario.invalidationPrice);
  if (riskPerUnit === 0) throw new Error("Invalidation distance cannot be zero");
  if (scenario.feeRate < 0 || scenario.slippageRate < 0) throw new Error("Costs cannot be negative");

  let bestR = 0;
  let worstR = 0;
  let targetHit = false;
  let invalidationHit = false;
  let intrabarAmbiguous = false;
  let exitReference = future.at(-1)?.close ?? entry.close;
  let exitEventTime = future.at(-1)?.eventTime ?? entry.eventTime;
  let exitCandleIndex = Math.max(0, future.length - 1);

  for (const [candleIndex, candle] of future.entries()) {
    const favorable = scenario.side === "LONG"
      ? (candle.high - entryPrice) / riskPerUnit
      : (entryPrice - candle.low) / riskPerUnit;
    const adverse = scenario.side === "LONG"
      ? (candle.low - entryPrice) / riskPerUnit
      : (entryPrice - candle.high) / riskPerUnit;

    bestR = Math.max(bestR, favorable);
    worstR = Math.min(worstR, adverse);

    const targetTouched = scenario.side === "LONG"
      ? candle.high >= scenario.targetPrice
      : candle.low <= scenario.targetPrice;
    const invalidationTouched = scenario.side === "LONG"
      ? candle.low <= scenario.invalidationPrice
      : candle.high >= scenario.invalidationPrice;

    if (targetTouched && invalidationTouched) {
      intrabarAmbiguous = true;
      exitReference = candle.close;
      exitEventTime = candle.eventTime;
      exitCandleIndex = candleIndex;
      break;
    }
    if (targetTouched) {
      targetHit = true;
      exitReference = scenario.targetPrice;
      exitEventTime = candle.eventTime;
      exitCandleIndex = candleIndex;
      break;
    }
    if (invalidationTouched) {
      invalidationHit = true;
      exitReference = scenario.invalidationPrice;
      exitEventTime = candle.eventTime;
      exitCandleIndex = candleIndex;
      break;
    }
  }

  const exitPrice = applyExitSlippage(exitReference, scenario.side, scenario.slippageRate);
  const grossReturn = directionalReturn(entryPrice, exitPrice, scenario.side);
  const feeReturnFraction = 2 * scenario.feeRate;
  const slippageFreeGrossReturn = directionalReturn(scenario.entryPrice, exitReference, scenario.side);
  const slippageReturnFraction = grossReturn - slippageFreeGrossReturn;
  const returnFraction = grossReturn - feeReturnFraction;

  return {
    returnFraction,
    mfeR: Math.max(0, bestR),
    maeR: Math.min(0, worstR),
    targetHit,
    invalidationHit,
    intrabarAmbiguous,
    exitPrice,
    exitEventTime,
    exitCandleIndex,
    grossReturnFraction: grossReturn,
    feeReturnFraction,
    slippageReturnFraction,
  };
}
