import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BinancePublicClient } from "../adapters/binance/public-client.js";
import { buildHistoricalResearchDataset } from "./historical-dataset.js";
import { runResearchLedger } from "./research-runner.js";
import { buildResearchReport } from "./report.js";
import { buildBaselines, buildBuyAndHoldBaseline } from "./baselines.js";
import { buildWalkForwardWindows } from "../backtest/walk-forward.js";
import { createExperimentArtifact } from "./experiment.js";
import { BASELINE_SETUP_ID } from "../setup/basic.js";
import { RESEARCH_END_EXCLUSIVE } from "./research-dataset-loader.js";

const PROTOCOL = {
  adr: "ADR-0002",
  protocolVersion: "phase3.v1",
  symbol: "BTCUSDT",
  market: "usdm-futures" as const,
  interval: "1h",
  datasetStart: "2020-01-01T00:00:00.000Z",
  datasetEnd: RESEARCH_END_EXCLUSIVE,
  train: { start: "2020-01-01T00:00:00.000Z", end: "2023-01-01T00:00:00.000Z" },
  validation: { start: "2023-01-01T00:00:00.000Z", end: "2024-01-01T00:00:00.000Z" },
  test: { start: "2024-01-01T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z" },
  holdout: { start: "2026-01-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" },
  horizonCandles: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  costMultipliers: [1, 1.5, 2],
  funding: "binance-usdm-historical-funding",
  purgeHours: 8,
  embargoHours: 8,
  randomSeed: 20261007,
};

function sliceByTime<T extends { eventTime: string }>(items: readonly T[], start: string, end: string): readonly T[] {
  const a = Date.parse(start), b = Date.parse(end);
  return items.filter((item) => { const t = Date.parse(item.eventTime); return t >= a && t < b; });
}
function hash(value: unknown): string {
  return "sha256:" + createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex");
}

const startedAt = new Date().toISOString();
const experimentId = `phase3-btcusdt-1h-${startedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
mkdirSync("research/registry", { recursive: true });
writeFileSync(`research/registry/${experimentId}.started.json`, JSON.stringify({ experimentId, status: "RUNNING", startedAt, protocol: PROTOCOL }, null, 2) + "\\n");

try {
  const client = new BinancePublicClient({ market: PROTOCOL.market });
  const dataset = await buildHistoricalResearchDataset({
    market: PROTOCOL.market,
    symbol: PROTOCOL.symbol,
    interval: PROTOCOL.interval,
    startTimeMs: Date.parse(PROTOCOL.datasetStart),
    endTimeMs: Date.parse(PROTOCOL.datasetEnd),
    expectedIntervalMs: 60 * 60 * 1000,
    methodologyVersion: "research-dataset.v1",
    lookback: 50,
    horizonCandles: PROTOCOL.horizonCandles,
    targetR: PROTOCOL.targetR,
    invalidationR: PROTOCOL.invalidationR,
    feeRate: PROTOCOL.feeRate,
    slippageRate: PROTOCOL.slippageRate,
    featureVersionPolicy: "core-v1",
    rejectGaps: true,
  }, client);
  const funding = await client.historicalFundingRates(PROTOCOL.symbol, Date.parse(PROTOCOL.datasetStart), Date.parse(PROTOCOL.datasetEnd));
  const observations = runResearchLedger(dataset.points, {
    lookback: 50, horizonCandles: PROTOCOL.horizonCandles, targetR: PROTOCOL.targetR, invalidationR: PROTOCOL.invalidationR,
    feeRate: PROTOCOL.feeRate, slippageRate: PROTOCOL.slippageRate, fundingRates: funding,
    dataVersion: dataset.manifest.datasetVersion.datasetVersion, featureVersionPolicy: "core-v1",
  });
  const testObservations = sliceByTime(observations, PROTOCOL.test.start, PROTOCOL.test.end);
  const report = buildResearchReport(testObservations, { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed });
  const baselines = [...buildBaselines(testObservations, dataset.points, funding, { feeRate: PROTOCOL.feeRate, slippageRate: PROTOCOL.slippageRate }, PROTOCOL.randomSeed), buildBuyAndHoldBaseline(sliceByTime(dataset.points, PROTOCOL.test.start, PROTOCOL.test.end), PROTOCOL.feeRate, PROTOCOL.slippageRate)];
  const sensitivity = PROTOCOL.costMultipliers.map((multiplier) => {
    const feeRate = PROTOCOL.feeRate * multiplier, slippageRate = PROTOCOL.slippageRate * multiplier;
    const o = runResearchLedger(dataset.points, { lookback: 50, horizonCandles: PROTOCOL.horizonCandles, targetR: PROTOCOL.targetR, invalidationR: PROTOCOL.invalidationR, feeRate, slippageRate, fundingRates: funding, dataVersion: dataset.manifest.datasetVersion.datasetVersion, featureVersionPolicy: "core-v1" });
    return { multiplier, report: buildResearchReport(sliceByTime(o, PROTOCOL.test.start, PROTOCOL.test.end), { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed }) };
  });
  const windows = buildWalkForwardWindows({ start: PROTOCOL.train.start, end: PROTOCOL.test.end, trainDurationMs: 3 * 365 * 24 * 60 * 60 * 1000, testDurationMs: 365 * 24 * 60 * 60 * 1000, stepDurationMs: 365 * 24 * 60 * 60 * 1000, purgeDurationMs: PROTOCOL.purgeHours * 60 * 60 * 1000, embargoDurationMs: PROTOCOL.embargoHours * 60 * 60 * 1000 });
  const experiment = createExperimentArtifact({
    experimentId, experimentVersion: "phase3.v1", datasetVersion: dataset.manifest.datasetVersion.datasetVersion, codeVersion: "runtime-git-ref-required", methodologyVersion: "research.v1",
    featureDefinitionVersions: ["core-v1"], setupVersion: BASELINE_SETUP_ID, outcomeProtocolVersion: "outcome.v1",
    trainingWindow: PROTOCOL.train, validationWindow: PROTOCOL.validation, testWindow: PROTOCOL.test, finalHoldoutWindow: PROTOCOL.holdout,
    configuration: { ...PROTOCOL, datasetArtifactHash: dataset.manifest.artifactHash },
  }, report, startedAt);
  const output = { experimentId, protocol: PROTOCOL, dataset: dataset.manifest, fundingEvents: funding.length, walkForwardWindows: windows, report, baselines, costSensitivity: sensitivity, experimentArtifactHash: experiment.artifactHash };
  const outputHash = hash(output);
  writeFileSync(`research/registry/${experimentId}.result.json`, JSON.stringify({ status: "COMPLETED", outputHash, output }, null, 2) + "\\n");
  console.log(JSON.stringify({ experimentId, outputHash, report, baselines, costSensitivity: sensitivity.map((s) => ({ multiplier: s.multiplier, meanR: s.report.all.mean, bootstrapLower: s.report.realizedRBootstrap?.interval.lower ?? null })) }, null, 2));
} catch (error) {
  const failure = { experimentId, status: "FAILED", error: error instanceof Error ? error.message : String(error) };
  writeFileSync(`research/registry/${experimentId}.failed.json`, JSON.stringify(failure, null, 2) + "\\n");
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
