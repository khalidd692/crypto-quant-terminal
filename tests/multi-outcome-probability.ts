import assert from "node:assert/strict";
import { createResearchObservation } from "../src/research/observation-ledger.js";
import { estimateOutcomeDistribution } from "../src/statistics/multi-outcome-probability.js";

const labels = ["TARGET", "INVALIDATION", "TIME_EXIT", "AMBIGUOUS"] as const;
const observations = labels.map((label, index) => createResearchObservation({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
  availableTime: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
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
    realizedR: label === "TARGET" ? 1 : label === "INVALIDATION" ? -1 : 0,
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
}));

const estimate = estimateOutcomeDistribution(
  observations,
  { setupId: "setup.test", side: "LONG" },
  "2025-01-01T05:00:00.000Z",
);

assert.ok(estimate);
assert.equal(estimate.sampleSize, 4);
assert.equal(estimate.probabilities.length, 4);
assert.equal(estimate.probabilities.reduce((sum, item) => sum + item.probability, 0), 1);
for (const item of estimate.probabilities) assert.equal(item.probability, 0.25);
assert.equal(estimate.expectancy.expectedValueR, 0);
assert.equal(estimate.probabilities.find((item) => item.event === "TARGET")?.meanRealizedR, 1);
assert.equal(estimate.probabilities.find((item) => item.event === "INVALIDATION")?.meanRealizedR, -1);
assert.equal(estimate.probabilities.find((item) => item.event === "AMBIGUOUS")?.meanRealizedR, 0);

const leaked = createResearchObservation({
  ...observations[0]!,
  eventTime: "2025-01-01T04:30:00.000Z",
  availableTime: "2025-01-01T06:00:00.000Z",
});
const noLeak = estimateOutcomeDistribution(
  [...observations, leaked],
  { setupId: "setup.test", side: "LONG" },
  "2025-01-01T05:00:00.000Z",
);
assert.equal(noLeak?.sampleSize, 4);

console.log("multi-outcome-probability: ok");
