import assert from "node:assert/strict";
import { createResearchObservation, type ResearchObservation } from "../src/research/observation-ledger.js";
import { runWalkForwardOOS } from "../src/backtest/walk-forward-runner.js";

function observation(index: number, availableLagMs = 0, outcome: "TARGET" | "INVALIDATION" | "TIME_EXIT" = "TARGET"): ResearchObservation {
  const eventTime = new Date(Date.UTC(2025, 0, 1, index)).toISOString();
  const availableTime = new Date(Date.parse(eventTime) + availableLagMs).toISOString();
  return createResearchObservation({
    instrumentId: "BTCUSDT-PERP",
    eventTime,
    availableTime,
    datasetVersion: "sha256:test",
    featureDefinitionVersions: ["feature.test.v1"],
    featureVersionPolicy: "test",
    featureSnapshot: [],
    regimeLabel: null,
    setupId: "setup.test",
    side: "LONG",
    entryReferencePrice: 100,
    horizonCandles: 1,
    horizonEndTime: new Date(Date.parse(eventTime) + 60 * 60 * 1000).toISOString(),
    targetR: 1,
    invalidationR: 1,
    outcome: {
      label: outcome,
      targetHit: outcome === "TARGET",
      invalidationHit: outcome === "INVALIDATION",
      timeExit: outcome === "TIME_EXIT",
      intrabarAmbiguous: false,
      mfeR: outcome === "TARGET" ? 1 : 0,
      maeR: outcome === "INVALIDATION" ? -1 : 0,
      realizedR: outcome === "TARGET" ? 1 : outcome === "INVALIDATION" ? -1 : 0,
      returnFraction: 0,
      exitPrice: 100,
      exitEventTime: new Date(Date.parse(eventTime) + 60 * 60 * 1000).toISOString(),
      feesReturn: 0,
      slippageReturn: 0,
      fundingReturn: 0,
    },
    dataAvailabilityRule: "availableTime <= decisionTime",
    eligible: true,
    exclusionReason: null,
  });
}

const observations = [
  observation(0, 0, "TARGET"),
  observation(1, 0, "INVALIDATION"),
  observation(2, 0, "TARGET"),
  observation(3, 0, "TARGET"),
  observation(4, 0, "INVALIDATION"),
  observation(5, 0, "TARGET"),
];

const result = runWalkForwardOOS(
  observations,
  {
    start: "2025-01-01T00:00:00.000Z",
    end: "2025-01-01T06:00:00.000Z",
    trainDurationMs: 2 * 60 * 60 * 1000,
    testDurationMs: 2 * 60 * 60 * 1000,
    stepDurationMs: 2 * 60 * 60 * 1000,
    purgeDurationMs: 60 * 60 * 1000,
    embargoDurationMs: 60 * 60 * 1000,
  },
  {
    version: "test-estimator.v1",
    estimate: (training) => training.filter((o) => o.outcome?.targetHit === true).length / training.length,
  },
);

assert.equal(result.methodologyVersion, "walk-forward-oos.v1");
assert.ok(result.windows.length >= 1);
assert.ok(result.predictions.length >= 1);
assert.ok(result.evaluatedPredictions >= 1);
assert.ok(result.brierScore !== null);
assert.ok(result.logLoss !== null);
assert.ok(result.windows.every((window) => window.trainingObservations >= 0));

const lateAvailable = observation(0, 2 * 60 * 60 * 1000, "TARGET");
const lateResult = runWalkForwardOOS(
  [lateAvailable, observation(1, 0, "INVALIDATION"), observation(2, 0, "TARGET")],
  {
    start: "2025-01-01T00:00:00.000Z",
    end: "2025-01-01T04:00:00.000Z",
    trainDurationMs: 60 * 60 * 1000,
    testDurationMs: 60 * 60 * 1000,
    stepDurationMs: 60 * 60 * 1000,
    purgeDurationMs: 0,
    embargoDurationMs: 0,
  },
  { version: "test.v1", estimate: (training) => training.length ? 0.5 : null },
);

assert.equal(lateResult.windows[0]?.trainingObservations, 0);
console.log("walk-forward-runner: ok");
