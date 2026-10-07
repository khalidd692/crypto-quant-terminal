import { createExperimentArtifact } from "../src/research/experiment.js";
import type { ResearchReport } from "../src/research/report.js";
import { BASELINE_SETUP_ID } from "../src/setup/basic.js";

const report: ResearchReport = {
  totalObservations: 4,
  cleanEligibleObservations: 4,
  ambiguousObservations: 0,
  long: { count: 2, mean: 0.5, median: 0.5, sum: 1, positiveFraction: 0.5, max: 1, min: -1 },
  short: { count: 2, mean: 0.5, median: 0.5, sum: 1, positiveFraction: 0.5, max: 1, min: -1 },
  all: { count: 4, mean: 0.5, median: 0.5, sum: 2, positiveFraction: 0.5, max: 1, min: -1 },
  targetHitRate: null,
  invalidationHitRate: null,
  drawdown: { maxDrawdownR: -1, maxDrawdownFraction: -1, peakIndex: 0, troughIndex: 1 },
  targetHitRateAdjusted: null,
  effectiveSampleSize: 0,
  realizedRBootstrap: null,
};

const spec = {
  experimentId: "baseline-v1",
  experimentVersion: "1.0.0",
  datasetVersion: "sha256:test",
  codeVersion: "git:test",
  methodologyVersion: "research.v1",
  featureDefinitionVersions: ["trend.ema_ratio@1"],
  setupVersion: BASELINE_SETUP_ID,
  outcomeProtocolVersion: "outcome.v1",
  trainingWindow: { start: "2025-01-01T00:00:00.000Z", end: "2025-06-01T00:00:00.000Z" },
  configuration: { horizonCandles: 8, targetR: 1.5, invalidationR: 1 },
};

const a = createExperimentArtifact(spec, report, "2026-01-01T00:00:00.000Z");
const b = createExperimentArtifact(spec, report, "2026-01-01T00:00:00.000Z");
if (a.artifactHash !== b.artifactHash) throw new Error("Experiment artifact is not deterministic");

const c = createExperimentArtifact(spec, report, "2027-01-01T00:00:00.000Z");
if (a.artifactHash !== c.artifactHash) throw new Error("Artifact hash must exclude creation metadata");
