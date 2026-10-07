import { buildHistoricalResearchDataset } from "../src/research/historical-dataset.js";

const points = Array.from({ length: 140 }, (_, i) => {
  const close = 100 + i * 0.2;
  const event = new Date(Date.UTC(2025, 11, 20, i)).toISOString() as any;
  return {
    instrumentId: "TEST",
    eventTime: event,
    availableTime: event,
    open: close - 0.1,
    high: close + 0.4,
    low: close - 0.4,
    close,
    volume: 1000 + i,
    dataQuality: "complete" as const,
    sourceId: `fixture:${i}`,
  };
});

const source = {
  async historicalKlines() {
    return points;
  },
};

const result = await buildHistoricalResearchDataset({
  market: "usdm-futures",
  symbol: "TEST",
  interval: "1h",
  startTimeMs: Date.parse(points[0]!.eventTime),
  endTimeMs: Date.parse(points.at(-1)!.eventTime),
  expectedIntervalMs: 60 * 60 * 1000,
  methodologyVersion: "research-v1",
  lookback: 50,
  horizonCandles: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  featureVersionPolicy: "core-v1",
  rejectGaps: true,
}, source);

if (!result.manifest.artifactHash.startsWith("sha256:")) throw new Error("Missing artifact hash");
if (!result.manifest.datasetVersion.datasetVersion.startsWith("sha256:")) throw new Error("Missing dataset hash");
if (result.manifest.pointCount !== points.length) throw new Error("Point count mismatch");
if (result.manifest.observationCount !== result.observations.length) throw new Error("Observation count mismatch");
if (!result.observationsJsonl.endsWith("\n")) throw new Error("JSONL must end with newline");
for (const observation of result.observations) {
  if (observation.datasetVersion !== result.manifest.datasetVersion.datasetVersion) {
    throw new Error("Observation dataset version mismatch");
  }
}
