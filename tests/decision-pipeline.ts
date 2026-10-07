import assert from "node:assert/strict";
import { createResearchObservation } from "../src/research/observation-ledger.js";
import { estimateOutcomeDistribution } from "../src/statistics/multi-outcome-probability.js";
import { evaluateDecisionPipeline } from "../src/decision/pipeline.js";

function observation(label: "TARGET" | "INVALIDATION" | "TIME_EXIT" | "AMBIGUOUS", index: number, realizedR: number) {
  const time = new Date(Date.UTC(2025, 0, 1, index)).toISOString();
  return createResearchObservation({
    instrumentId: "TEST",
    eventTime: time,
    availableTime: time,
    datasetVersion: "sha256:test",
    featureDefinitionVersions: ["test.v1"],
    featureVersionPolicy: "test",
    featureSnapshot: [],
    regimeLabel: null,
    setupId: "setup.test",
    side: "LONG",
    entryReferencePrice: 100,
    horizonCandles: 1,
    horizonEndTime: new Date(Date.UTC(2025, 0, 1, index + 1)).toISOString(),
    targetR: 1,
    invalidationR: 1,
    outcome: {
      label,
      targetHit: label === "TARGET",
      invalidationHit: label === "INVALIDATION",
      timeExit: label === "TIME_EXIT",
      intrabarAmbiguous: label === "AMBIGUOUS",
      mfeR: 0,
      maeR: 0,
      realizedR,
      returnFraction: 0,
      exitPrice: 100,
      exitEventTime: new Date(Date.UTC(2025, 0, 1, index + 1)).toISOString(),
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
  observation("TARGET", 0, 1),
  observation("TARGET", 1, 1),
  observation("TARGET", 2, 1),
  observation("INVALIDATION", 3, -1),
  observation("TIME_EXIT", 4, 0.2),
];
const distribution = estimateOutcomeDistribution(
  observations,
  { setupId: "setup.test", side: "LONG" },
  "2025-01-01T05:00:00.000Z",
);
assert.ok(distribution);
assert.ok(distribution.expectancy.expectedValueR > 0);

const result = evaluateDecisionPipeline({
  side: "LONG",
  outcomeDistribution: distribution,
  evidencePolicy: { maxTargetIntervalWidth: 0.8, maxAmbiguousProbability: 0 },
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(result.decision, "LONG");
assert.ok(result.expectancy);
assert.ok(result.expectancy.expectedValue > 0.1);

const lowExpectancy = evaluateDecisionPipeline({
  side: "LONG",
  outcomeDistribution: estimateOutcomeDistribution(
    [
      observation("TARGET", 0, 0.05),
      observation("INVALIDATION", 1, -0.05),
      observation("TIME_EXIT", 2, 0),
      observation("TARGET", 3, 0.05),
    ],
    { setupId: "setup.test", side: "LONG" },
    "2025-01-01T05:00:00.000Z",
  ),
  evidencePolicy: { maxTargetIntervalWidth: 0.8, maxAmbiguousProbability: 0 },
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(lowExpectancy.decision, "WAIT");

const hardVeto = evaluateDecisionPipeline({
  side: "LONG",
  outcomeDistribution: distribution,
  evidencePolicy: { maxTargetIntervalWidth: 0.8, maxAmbiguousProbability: 0 },
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: false,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(hardVeto.decision, "NO_TRADE");

console.log("decision-pipeline: ok");
