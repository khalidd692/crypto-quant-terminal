import { buildHistoricalResearchDataset } from "../research/historical-dataset.js";
import { trainFrozenTerminalEstimator, type FrozenTerminalEstimator } from "./model.js";

const TRAIN_START = "2020-01-01T00:00:00.000Z";
const TRAIN_END = "2023-01-01T00:00:00.000Z";

let cached: Promise<FrozenTerminalEstimator> | null = null;

export function loadFrozenTerminalEstimator(): Promise<FrozenTerminalEstimator> {
  if (cached) return cached;
  cached = (async () => {
    const dataset = await buildHistoricalResearchDataset({
      market: "usdm-futures",
      symbol: "BTCUSDT",
      interval: "1h",
      startTimeMs: Date.parse(TRAIN_START),
      endTimeMs: Date.parse(TRAIN_END),
      expectedIntervalMs: 60 * 60 * 1000,
      methodologyVersion: "terminal-train-only.v1",
      lookback: 50,
      horizonCandles: 8,
      targetR: 1.5,
      invalidationR: 1,
      feeRate: 0.0004,
      slippageRate: 0.0002,
      featureVersionPolicy: "core-v1",
      rejectGaps: true,
    });
    return trainFrozenTerminalEstimator(dataset.observations, TRAIN_END);
  })();
  return cached;
}
