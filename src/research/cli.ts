import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BinancePublicClient } from "../adapters/binance/public-client.js";
import { BinanceVisionHistoricalClient } from "../adapters/binance/vision-public-data.js";
import { buildHistoricalResearchDataset } from "./historical-dataset.js";
import { runResearchLedger } from "./research-runner.js";
import { buildResearchReport } from "./report.js";
import { buildPhase3PartitionReport, finalizeCriteria, type Phase3PartitionReport } from "./phase3-report.js";
import { estimateOutcomeDistribution } from "../statistics/multi-outcome-probability.js";
import { BASELINE_SETUP_ID } from "../setup/basic.js";
import { RESEARCH_END_EXCLUSIVE } from "./research-dataset-loader.js";
import type { ResearchObservation } from "./observation-ledger.js";

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
  lookback: 50,
  horizonCandles: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  costMultipliers: [1, 1.5, 2] as const,
  randomSeed: 20261007,
  randomDraws: 1000,
};

function sliceByTime<T extends { eventTime: string }>(items: readonly T[], start: string, end: string): readonly T[] {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return items.filter((item) => {
    const t = Date.parse(item.eventTime);
    return t >= a && t < b;
  });
}

function hash(value: unknown): string {
  return "sha256:" + createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function costAdjustedObservations(observations: readonly ResearchObservation[], multiplier: number): readonly ResearchObservation[] {
  return observations.map((observation) => {
    if (!observation.outcome) return observation;
    const outcome = observation.outcome;
    const atrRatio = observation.featureSnapshot.find((feature) => feature.featureId === "volatility.atr_ratio")?.value ?? null;
    const riskFraction = atrRatio !== null && Number.isFinite(atrRatio)
      ? atrRatio * (observation.invalidationR ?? 0)
      : 0;
    if (!(riskFraction > 0)) return observation;
    const extraFee = outcome.feesReturn * (multiplier - 1);
    const extraSlippage = outcome.slippageReturn * (multiplier - 1);
    return {
      ...observation,
      outcome: {
        ...outcome,
        realizedR: outcome.realizedR + (extraFee + extraSlippage) / riskFraction,
      },
    };
  });
}

function trainModel(observations: readonly ResearchObservation[], trainEnd: string) {
  return (["LONG", "SHORT"] as const).map((side) => ({
    side,
    estimate: estimateOutcomeDistribution(observations, { setupId: BASELINE_SETUP_ID, side }, trainEnd),
  }));
}

const startedAt = new Date().toISOString();
const experimentId = `phase3-btcusdt-1h-${startedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
mkdirSync("research/registry", { recursive: true });
writeFileSync(
  `research/registry/${experimentId}.started.json`,
  JSON.stringify({ experimentId, status: "RUNNING", startedAt, protocol: PROTOCOL, holdoutConsumed: false }, null, 2) + "\n",
);

try {
  const client = new BinancePublicClient({ market: PROTOCOL.market, baseUrlOverride: "https://data-api.binance.vision" });
  const dataset = await buildHistoricalResearchDataset({
    market: PROTOCOL.market,
    symbol: PROTOCOL.symbol,
    interval: PROTOCOL.interval,
    startTimeMs: Date.parse(PROTOCOL.datasetStart),
    endTimeMs: Date.parse(PROTOCOL.datasetEnd),
    expectedIntervalMs: 60 * 60 * 1000,
    methodologyVersion: "research-dataset.v1",
    lookback: PROTOCOL.lookback,
    horizonCandles: PROTOCOL.horizonCandles,
    targetR: PROTOCOL.targetR,
    invalidationR: PROTOCOL.invalidationR,
    feeRate: PROTOCOL.feeRate,
    slippageRate: PROTOCOL.slippageRate,
    featureVersionPolicy: "core-v1",
    rejectGaps: true,
  }, client);
  const fundingClient = new BinanceVisionHistoricalClient(fetch, process.env.PHASE3_FUNDING_DIR);
  const funding = await fundingClient.historicalFundingRates(
    PROTOCOL.symbol,
    Date.parse(PROTOCOL.datasetStart),
    Date.parse(PROTOCOL.datasetEnd),
  );

  const observations = runResearchLedger(dataset.points, {
    lookback: PROTOCOL.lookback,
    horizonCandles: PROTOCOL.horizonCandles,
    targetR: PROTOCOL.targetR,
    invalidationR: PROTOCOL.invalidationR,
    feeRate: PROTOCOL.feeRate,
    slippageRate: PROTOCOL.slippageRate,
    fundingRates: funding,
    dataVersion: dataset.manifest.datasetVersion.datasetVersion,
    featureVersionPolicy: "core-v1",
  });

  const trainObservations = sliceByTime(observations, PROTOCOL.train.start, PROTOCOL.train.end);
  const validationObservations = sliceByTime(observations, PROTOCOL.validation.start, PROTOCOL.validation.end);
  const trainModelEstimates = trainModel(trainObservations, PROTOCOL.train.end);
  const validationBase = buildPhase3PartitionReport(
    "validation",
    validationObservations,
    dataset.points,
    funding,
    PROTOCOL.train.end,
    { feeRate: PROTOCOL.feeRate, slippageRate: PROTOCOL.slippageRate },
  );
  const validationStress = buildResearchReport(
    costAdjustedObservations(validationObservations, 1.5),
    { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed },
  );
  const validationReport = finalizeCriteria(validationBase, validationStress.realizedRBootstrap);

  const allowTest = process.env.PHASE3_TESTS_GREEN === "true";
  let testReport: Phase3PartitionReport | null = null;
  let testCostSensitivity: Record<string, unknown> | null = null;
  if (allowTest) {
    const testObservations = sliceByTime(observations, PROTOCOL.test.start, PROTOCOL.test.end);
    const testBase = buildPhase3PartitionReport(
      "test",
      testObservations,
      dataset.points,
      funding,
      PROTOCOL.train.end,
      { feeRate: PROTOCOL.feeRate, slippageRate: PROTOCOL.slippageRate },
    );
    const testStress = buildResearchReport(
      costAdjustedObservations(testObservations, 1.5),
      { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed },
    );
    testReport = finalizeCriteria(testBase, testStress.realizedRBootstrap);
    testCostSensitivity = Object.fromEntries(PROTOCOL.costMultipliers.map((multiplier) => {
      const adjusted = costAdjustedObservations(testObservations, multiplier);
      return [String(multiplier), {
        meanRealizedR: buildResearchReport(adjusted, { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed }).all.mean,
        annual: buildResearchReport(adjusted, { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed }).annual,
      }];
    }));
  }

  const output = {
    experimentId,
    protocol: PROTOCOL,
    dataset: dataset.manifest,
    holdoutConsumed: false,
    trainModelEstimates,
    validation: {
      ...validationReport,
      costSensitivity: Object.fromEntries(PROTOCOL.costMultipliers.map((multiplier) => {
        const adjusted = costAdjustedObservations(validationObservations, multiplier);
        const report = buildResearchReport(adjusted, { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: PROTOCOL.randomSeed });
        return [String(multiplier), { meanRealizedR: report.all.mean, annual: report.annual }];
      })),
    },
    test: testReport ? { ...testReport, costSensitivity: testCostSensitivity } : null,
    testEvaluated: allowTest,
  };
  const outputHash = hash(output);
  writeFileSync(
    `research/registry/${experimentId}.result.json`,
    JSON.stringify({ status: "COMPLETED", outputHash, output }, null, 2) + "\n",
  );
  console.log(JSON.stringify({
    experimentId,
    outputHash,
    validationVerdict: validationReport.criteria.verdict,
    testVerdict: testReport?.criteria.verdict ?? "NOT_EVALUATED",
    testEvaluated: allowTest,
  }, null, 2));
  if (allowTest && testReport && (validationReport.criteria.verdict !== "EDGE" || testReport.criteria.verdict !== "EDGE")) {
    console.log("PAS D'EDGE");
  }
} catch (error) {
  const failure = {
    experimentId,
    status: "FAILED",
    holdoutConsumed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  writeFileSync(`research/registry/${experimentId}.failed.json`, JSON.stringify(failure, null, 2) + "\n");
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
