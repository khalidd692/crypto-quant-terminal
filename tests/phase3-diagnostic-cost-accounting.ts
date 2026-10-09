import { reconstructGrossReturnFraction } from "../src/research/phase3-diagnostics.js";
import { simulateOutcome } from "../src/simulation/outcomes.js";
import type { ISO8601, MarketDataPoint } from "../src/domain/types.js";

// Simulator convention: returnFraction is already net of fees; slippageReturn
// is signed (slipped return minus slippage-free return), normally <= 0.
const gross = reconstructGrossReturnFraction(0.012, 0.0008, -0.0004);
const netExcludingFunding = 0.012;
const feeCost = 0.0008;
const slippageCost = 0.0004;
const observedCost = gross - netExcludingFunding;
if (Math.abs(observedCost - (feeCost + slippageCost)) > 1e-12) {
  throw new Error(`gross - net excluding funding must equal fees + slippage: ${observedCost}`);
}
if (observedCost < 0) throw new Error("Gross return must not be below net excluding funding when costs are positive");

// Funding is a separate signed component and must not enter gross reconstruction.
const fundingReturn = -0.0002;
const netIncludingFunding = netExcludingFunding + fundingReturn;
if (Math.abs((gross - netIncludingFunding) - (feeCost + slippageCost - fundingReturn)) > 1e-12) {
  throw new Error("Funding must remain separate from gross-versus-net cost reconciliation");
}
const candle = (hour: number, open: number, high: number, low: number, close: number): MarketDataPoint => ({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, hour)).toISOString() as ISO8601,
  availableTime: new Date(Date.UTC(2026, 0, 1, hour, 1)).toISOString() as ISO8601,
  open, high, low, close, volume: 100, dataQuality: "complete", sourceId: "fixture",
});
const entry = candle(0, 100, 101, 99, 100);
const target = candle(1, 100, 105, 99, 104);
const simulated = simulateOutcome(entry, [target], {
  side: "LONG", entryPrice: 100, targetPrice: 104, invalidationPrice: 98,
  feeRate: 0.001, slippageRate: 0.0005,
});
const reconstructed = reconstructGrossReturnFraction(
  simulated.returnFraction, simulated.feeReturnFraction, simulated.slippageReturnFraction,
);
const actualCostGap = reconstructed - simulated.returnFraction;
const expectedCostGap = simulated.feeReturnFraction - simulated.slippageReturnFraction;
if (Math.abs(actualCostGap - expectedCostGap) > 1e-12 || actualCostGap < 0) {
  throw new Error("Simulator gross minus net (excluding funding) must equal positive fees plus slippage");
}
if (Math.abs(simulated.returnFraction - (simulated.grossReturnFraction - simulated.feeReturnFraction)) > 1e-12) {
  throw new Error("Diagnostic changes must not alter the simulator's net return");
}
console.log("phase3-diagnostic-cost-accounting: ok");
