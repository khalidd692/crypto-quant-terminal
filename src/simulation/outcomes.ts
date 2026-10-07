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
  readonly mfeR: number;
  readonly maeR: number;
  readonly targetHit: boolean;
  readonly invalidationHit: boolean;
  readonly intrabarAmbiguous: boolean;
}

export function simulateOutcome(
  entry: MarketDataPoint,
  future: readonly MarketDataPoint[],
  scenario: OutcomeScenario,
): SimulatedOutcome {
  const entryPrice = scenario.entryPrice * (1 + scenario.slippageRate * (scenario.side === "LONG" ? 1 : -1));
  const riskPerUnit = Math.abs(entryPrice - scenario.invalidationPrice);
  if (riskPerUnit === 0) throw new Error("Invalidation distance cannot be zero");

  let bestR = -Infinity;
  let worstR = Infinity;
  let targetHit = false;
  let invalidationHit = false;
  let intrabarAmbiguous = false;

  for (const candle of future) {
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
      break;
    }
    if (targetTouched) { targetHit = true; break; }
    if (invalidationTouched) { invalidationHit = true; break; }
  }

  const last = future.at(-1)?.close ?? entry.close;
  const grossReturn = scenario.side === "LONG"
    ? (last - entryPrice) / entryPrice
    : (entryPrice - last) / entryPrice;
  const roundTripCost = 2 * scenario.feeRate;
  return {
    returnFraction: grossReturn - roundTripCost,
    mfeR: Number.isFinite(bestR) ? bestR : 0,
    maeR: Number.isFinite(worstR) ? worstR : 0,
    targetHit,
    invalidationHit,
    intrabarAmbiguous,
  };
}
