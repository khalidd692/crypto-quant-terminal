import assert from "node:assert/strict";
import { createResearchObservation, type ResearchObservation } from "../src/research/observation-ledger.js";
import { runFinalHoldout } from "../src/backtest/final-holdout.js";

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
      mfeR: 0,
      maeR: 0,
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

const result = runFinalHoldout(
  [
    observation(0),
    observation(1, 0, "INVALIDATION"),
    observation(2),
    observation(3, 2 * 60 * 60 * 1000),
    observation(4),
  ],
  {
    start: "2025-01-01T02:00:00.000Z",
    end: "2025-01-01T05:00:00.000Z",
    modelVersion: "model.v1",
    modelTrainingEnd: "2025-01-01T02:00:00.000Z",
  },
  {
    version: "model.v1",
    predict: () => 0.75,
  },
);

assert.equal(result.modelVersion, "model.v1");
assert.equal(result.holdoutObservations, 2);
assert.equal(result.predictions.length, 2);
assert.equal(result.evaluatedPredictions, 2);
assert.ok(result.brierScore !== null);
assert.ok(result.logLoss !== null);
assert.equal(result.coverage, 1);

assert.throws(
  () => runFinalHoldout([], {
    start: "2025-01-01T01:00:00.000Z",
    end: "2025-01-01T02:00:00.000Z",
    modelVersion: "model.v1",
    modelTrainingEnd: "2025-01-01T01:30:00.000Z",
  }, { version: "model.v1", predict: () => 0.5 }),
  /training must end before final holdout starts/,
);

console.log("final-holdout: ok");
