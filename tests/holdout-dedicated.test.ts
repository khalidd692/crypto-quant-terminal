import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createResearchObservation } from "../src/research/observation-ledger.js";
import { createFrozenHoldoutArtifact, executeDedicatedHoldout } from "../src/holdout/dedicated.js";

const t0 = "2026-02-01T00:00:00.000Z";
const t1 = "2026-02-01T01:00:00.000Z";
const observation = createResearchObservation({
  instrumentId: "FAKE",
  eventTime: t0,
  availableTime: t0,
  datasetVersion: "sha256:fake",
  featureDefinitionVersions: ["fake.v1"],
  featureVersionPolicy: "fake",
  featureSnapshot: [],
  regimeLabel: null,
  setupId: "fake.setup",
  side: "LONG",
  entryReferencePrice: 100,
  horizonCandles: 1,
  horizonEndTime: t1,
  targetR: 1,
  invalidationR: 1,
  outcome: {
    label: "TARGET",
    targetHit: true,
    invalidationHit: false,
    timeExit: false,
    intrabarAmbiguous: false,
    mfeR: 1,
    maeR: 0,
    realizedR: 1,
    returnFraction: 0.01,
    exitPrice: 101,
    exitEventTime: t1,
    feesReturn: 0,
    slippageReturn: 0,
    fundingReturn: 0,
  },
  dataAvailabilityRule: "availableTime <= decisionTime",
  eligible: true,
  exclusionReason: null,
});

const artifact = createFrozenHoldoutArtifact([observation]);
const registry = join(tmpdir(), "crypto-quant-terminal-holdout-self-test.json");
if (existsSync(registry)) unlinkSync(registry);

const execution = executeDedicatedHoldout(
  artifact,
  { version: "fake-model.v1", predict: () => 0.75 },
  registry,
);

assert.equal(execution.result.holdoutObservations, 1);
assert.equal(execution.result.evaluatedPredictions, 1);
assert.equal(execution.result.methodologyVersion, "final-holdout.v1");
assert.equal(execution.artifactHash, artifact.contentHash);
assert.throws(() => executeDedicatedHoldout(
  artifact,
  { version: "fake-model.v1", predict: () => 0.75 },
  registry,
), /already been executed/);

unlinkSync(registry);
console.log("holdout-dedicated fake-data self-test: ok");
