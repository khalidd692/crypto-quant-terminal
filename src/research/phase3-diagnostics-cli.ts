import { mkdirSync, writeFileSync } from "node:fs";
import { BinancePublicClient } from "../adapters/binance/public-client.js";
import { BinanceVisionHistoricalClient } from "../adapters/binance/vision-public-data.js";
import { buildHistoricalResearchDataset } from "./historical-dataset.js";
import { runResearchLedger } from "./research-runner.js";
import { buildResearchReport } from "./report.js";
import { buildPhase3StateDiagnostics, buildExclusionDiagnostic } from "./phase3-diagnostics.js";
import { RESEARCH_END_EXCLUSIVE } from "./research-dataset-loader.js";

const CONFIG = {
  symbol: "BTCUSDT",
  market: "usdm-futures" as const,
  interval: "1h",
  datasetStart: "2020-01-01T00:00:00.000Z",
  datasetEnd: RESEARCH_END_EXCLUSIVE,
  trainEnd: "2023-01-01T00:00:00.000Z",
  validationEnd: "2024-01-01T00:00:00.000Z",
  testEnd: "2026-01-01T00:00:00.000Z",
  lookback: 50,
  horizonCandles: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  randomSeed: 20261007,
  randomDraws: 1000,
  expectedDatasetVersion: "sha256:6684d0e7bfb27080430164729e6aa8ac556ac09a728f373eeb32ef3b4781abce",
  expectedPointCount: 52576,
  expectedObservationCount: 52518,
};

function sliceByTime<T extends { eventTime: string }>(items: readonly T[], start: string, end: string): readonly T[] {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return items.filter((item) => {
    const t = Date.parse(item.eventTime);
    return t >= a && t < b;
  });
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertNear(actual: number | null, expected: number, label: string): void {
  if (actual === null || Math.abs(actual - expected) > 1e-12) {
    throw new Error(`${label}: expected ${expected}, got ${String(actual)}`);
  }
}

const client = new BinancePublicClient({
  market: CONFIG.market,
  baseUrlOverride: "https://data-api.binance.vision",
});
const dataset = await buildHistoricalResearchDataset({
  market: CONFIG.market,
  symbol: CONFIG.symbol,
  interval: CONFIG.interval,
  startTimeMs: Date.parse(CONFIG.datasetStart),
  endTimeMs: Date.parse(CONFIG.datasetEnd),
  expectedIntervalMs: 60 * 60 * 1000,
  methodologyVersion: "research-dataset.v1",
  lookback: CONFIG.lookback,
  horizonCandles: CONFIG.horizonCandles,
  targetR: CONFIG.targetR,
  invalidationR: CONFIG.invalidationR,
  feeRate: CONFIG.feeRate,
  slippageRate: CONFIG.slippageRate,
  featureVersionPolicy: "core-v1",
  rejectGaps: true,
}, client);

assertEqual(dataset.manifest.datasetVersion.datasetVersion, CONFIG.expectedDatasetVersion, "datasetVersion");
assertEqual(dataset.manifest.pointCount, CONFIG.expectedPointCount, "pointCount");
assertEqual(dataset.manifest.observationCount, CONFIG.expectedObservationCount, "observationCount");

const fundingClient = new BinanceVisionHistoricalClient(fetch, process.env.PHASE3_FUNDING_DIR);
const funding = await fundingClient.historicalFundingRates(
  CONFIG.symbol,
  Date.parse(CONFIG.datasetStart),
  Date.parse(CONFIG.datasetEnd),
);

const observations = runResearchLedger(dataset.points, {
  lookback: CONFIG.lookback,
  horizonCandles: CONFIG.horizonCandles,
  targetR: CONFIG.targetR,
  invalidationR: CONFIG.invalidationR,
  feeRate: CONFIG.feeRate,
  slippageRate: CONFIG.slippageRate,
  dataVersion: dataset.manifest.datasetVersion.datasetVersion,
  featureVersionPolicy: "core-v1",
});

assertEqual(observations.length, CONFIG.expectedObservationCount, "ledger observation count");

const validation = sliceByTime(observations, CONFIG.trainEnd, CONFIG.validationEnd);
const test = sliceByTime(observations, CONFIG.validationEnd, CONFIG.testEnd);

const validationReport = buildResearchReport(validation, {
  blockSize: 8,
  bootstrapResamples: 2000,
  confidenceLevel: 0.95,
  bootstrapSeed: CONFIG.randomSeed,
});
const testReport = buildResearchReport(test, {
  blockSize: 8,
  bootstrapResamples: 2000,
  confidenceLevel: 0.95,
  bootstrapSeed: CONFIG.randomSeed,
});

assertEqual(validationReport.totalObservations, 8759, "validation total");
assertEqual(validationReport.cleanEligibleObservations, 3790, "validation clean");
assertEqual(validationReport.ambiguousObservations, 52, "validation ambiguous");
assertNear(validationReport.all.mean, -0.27387454648158277, "validation mean R");
assertEqual(testReport.totalObservations, 17536, "test total");
assertEqual(testReport.cleanEligibleObservations, 8964, "test clean");
assertEqual(testReport.ambiguousObservations, 100, "test ambiguous");
assertNear(testReport.all.mean, -0.20397163645157348, "test mean R");

const validationExclusions = buildExclusionDiagnostic(validation);
const testExclusions = buildExclusionDiagnostic(test);
const validationStates = buildPhase3StateDiagnostics(
  validation, dataset.points, funding,
  { feeRate: CONFIG.feeRate, slippageRate: CONFIG.slippageRate },
  CONFIG.randomSeed, CONFIG.randomDraws,
);
const testStates = buildPhase3StateDiagnostics(
  test, dataset.points, funding,
  { feeRate: CONFIG.feeRate, slippageRate: CONFIG.slippageRate },
  CONFIG.randomSeed, CONFIG.randomDraws,
);

const output = {
  status: "COMPLETED",
  scope: "diagnostic-only",
  methodologyUnchanged: true,
  holdoutConsumed: false,
  adr: "ADR-0002",
  historicalResultModified: false,
  datasetVersion: CONFIG.expectedDatasetVersion,
  calibration: {
    seed: CONFIG.randomSeed,
    observations: 6250,
    horizonCandles: 8,
    targetR: 1.5,
    invalidationR: 1,
    volatilityModel: "synthetic random walk: fixed ±0.25 price step around 100; historical-geometry calibration: candleSigma=0.525, baseRangeSigma=0.25, intrabarSteps=8, wideWickProbability=0.002, wideWickMean=2, wideWickSigma=0.2",
    parameterTunedOnMeanR: false,
  },
  exclusionAccounting: {
    outsideObservationWindow: {
      warmup: CONFIG.lookback,
      tail: CONFIG.horizonCandles,
    },
    validation: validationExclusions,
    test: testExclusions,
  },
  stateMeansR: {
    validation: validationStates,
    test: testStates,
  },
  historicalReference: {
    validationMeanR: validationReport.all.mean,
    testMeanR: testReport.all.mean,
    calibrationTimeExitGrossR: 0.26740864604811676,
  },
};

mkdirSync("research/diagnostics", { recursive: true });
const path = "research/diagnostics/phase3-diagnostic-20261008.json";
writeFileSync(path, JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output, null, 2));
console.log(`WROTE ${path}`);
