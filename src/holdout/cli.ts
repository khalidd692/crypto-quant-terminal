import { readFileSync } from "node:fs";
import { executeDedicatedHoldout, loadFrozenHoldoutArtifact } from "./dedicated.js";
import type { ResearchObservation } from "../research/observation-ledger.js";

const artifactPath = process.env.HOLDOUT_ARTIFACT_PATH ?? "research/holdout/holdout-observations.json";
const registryPath = process.env.HOLDOUT_REGISTRY_PATH ?? "research/registry/final-holdout.execution.json";
const modelPath = process.env.FROZEN_HOLDOUT_MODEL_PATH ?? "research/holdout/frozen-model.json";

const artifact = loadFrozenHoldoutArtifact(artifactPath);
const modelFile = JSON.parse(readFileSync(modelPath, "utf8")) as {
  readonly version: string;
  readonly longProbability: number;
  readonly shortProbability: number;
};

const model = {
  version: modelFile.version,
  predict: (observation: ResearchObservation) => {
    if (observation.side === "LONG") return modelFile.longProbability;
    if (observation.side === "SHORT") return modelFile.shortProbability;
    return null;
  },
};

const execution = executeDedicatedHoldout(artifact, model, registryPath);
console.log(JSON.stringify({
  status: "COMPLETED",
  registryPath: execution.registryPath,
  artifactHash: execution.artifactHash,
  result: execution.result,
}, null, 2));
