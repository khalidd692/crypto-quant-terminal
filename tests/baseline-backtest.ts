import { runBaselineBacktest, summarizeBaseline } from "../src/research/baseline-backtest.js";

const points = Array.from({ length: 140 }, (_, i) => {
  const close = 100 + i * 0.2;
  return {
    instrumentId: "TEST",
    eventTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
    availableTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
    open: close - 0.1,
    high: close + 0.3,
    low: close - 0.3,
    close,
    volume: 1000 + i,
    dataQuality: "complete" as const,
    sourceId: "fixture",
  };
});

const result = runBaselineBacktest(points, {
  lookback: 50,
  horizon: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  dataVersion: "fixture-v1",
});
const summary = summarizeBaseline(result);
if (summary.observations < 0) throw new Error("Summary observation count invalid");
if (summary.targetProbability && (summary.targetProbability.probability < 0 || summary.targetProbability.probability > 1)) {
  throw new Error("Probability outside [0,1]");
}
