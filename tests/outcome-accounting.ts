import { simulateOutcome } from "../src/simulation/outcomes.js";
import type { MarketDataPoint } from "../src/domain/types.js";

const candle = (hour: number, open: number, high: number, low: number, close: number): MarketDataPoint => ({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(),
  availableTime: new Date(Date.UTC(2026, 0, 1, hour, 1)).toISOString(),
  open,
  high,
  low,
  close,
  volume: 100,
  sourceId: "fixture",
});

const entry = candle(0, 100, 101, 99, 100);
const target = candle(1, 100, 105, 99, 104);
const result = simulateOutcome(entry, [target], {
  side: "LONG",
  entryPrice: 100,
  targetPrice: 104,
  invalidationPrice: 98,
  feeRate: 0.001,
  slippageRate: 0.0005,
});

if (!result.targetHit || result.invalidationHit) throw new Error("Target outcome mismatch");
if (result.exitEventTime !== target.eventTime) throw new Error("Exit timestamp is not the hit candle");
if (result.exitCandleIndex !== 0) throw new Error("Exit candle index mismatch");
if (result.feeReturnFraction !== 0.002) throw new Error("Fee accounting mismatch");
if (result.grossReturnFraction <= 0) throw new Error("Gross return should be positive");
if (result.slippageReturnFraction >= 0) throw new Error("Long trade slippage should reduce return");
