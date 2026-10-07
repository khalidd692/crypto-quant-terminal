import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createResearchObservation } from "../src/research/observation-ledger.js";
import { createFrozenHoldoutArtifact, executeDedicatedHoldout } from "../src/holdout/dedicated.js";

const observation = createResearchObservation({
  instrumentId: "BTCUSDT",
  eventTime: "2026-02-01T00:00:00.000Z",
  availableTime: "2026-02-01T00:00:00.000Z",
  datasetVersion: "sha256:fake-holdout",
  featureDefinitionVersions: ["core-v1"],
  featureVersionPolicy: "core-v1",
  featureSnapshot: [],
  setupId: "baseline.trend.v1",
  side: "LONG",
  regimeLabel: "TREND_UP",
  entryReferencePrice: 100,
  horizonCandles: 8,
  horizonEndTime: "2026-02-01T08:00:00.000Z",
  targetR: 1.5,
  invalidationR: 1,
  outcome: {
    label: "TARGET",
    targetHit: true,
    invalidationHit: false,
    timeExit: false,
    intrabarAmbiguous: false,
    mfeR: 1.5,
    maeR: 0.1,
    realizedR: 1.49,
    returnFraction: 0.0149,
    exitPrice: 101.5,
    exitEventTime: "2026-02-01T08:00:00.000Z",
    feesReturn: -0.0008,
    slippageReturn: -0.0004,
    fundingReturn: 0,
  },
  dataAvailabilityRule: "fake",
  eligible: true,
  exclusionReason: null,
});

const artifact = createFrozenHoldoutArtifact([observation]);
const directory = mkdtempSync(join(tmpdir(), "phase3-holdout-"));
const registryPath = join(directory, "execution.json");

const execution = executeDedicatedHoldout(
  artifact,
  { version: "fake-model-v1", predict: () => 0.8 },
  registryPath,
);
assert.equal(execution.artifactHash, artifact.contentHash);
assert.equal(execution.result.modelVersion, "fake-model-v1");
assert.equal(execution.result.holdoutObservations, 1);

assert.throws(
  () => executeDedicatedHoldout(artifact, { version: "fake-model-v1", predict: () => 0.8 }, registryPath),
  /already been executed/,
);

const tampered = { ...artifact, contentHash: "sha256:tampered" };
assert.throws(
  () => executeDedicatedHoldout(tampered, { version: "fake-model-v1", predict: () => 0.8 }, join(directory, "tampered.json")),
  /hash mismatch/,
);

rmSync(directory, { recursive: true, force: true });
