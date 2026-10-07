import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { ResearchObservation } from "../research/observation-ledger.js";
import { runFinalHoldout, type FinalHoldoutResult, type FrozenHoldoutModel } from "../backtest/final-holdout.js";
import { HOLDOUT_END, HOLDOUT_START } from "../research/holdout-dataset.js";

export interface FrozenHoldoutArtifact {
  readonly artifactVersion: "holdout-observations.v1";
  readonly start: typeof HOLDOUT_START;
  readonly end: typeof HOLDOUT_END;
  readonly contentHash: string;
  readonly observations: readonly ResearchObservation[];
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => JSON.stringify(key) + ":" + canonical(value)).join(",") + "}";
}

export function hashHoldoutObservations(observations: readonly ResearchObservation[]): string {
  return "sha256:" + createHash("sha256").update(canonical(observations)).digest("hex");
}

export function createFrozenHoldoutArtifact(
  observations: readonly ResearchObservation[],
): FrozenHoldoutArtifact {
  const start = Date.parse(HOLDOUT_START);
  const end = Date.parse(HOLDOUT_END);
  for (const observation of observations) {
    const event = Date.parse(observation.eventTime);
    if (!Number.isFinite(event) || event < start || event >= end) {
      throw new Error("Holdout observation outside frozen UTC interval");
    }
  }
  return {
    artifactVersion: "holdout-observations.v1",
    start: HOLDOUT_START,
    end: HOLDOUT_END,
    contentHash: hashHoldoutObservations(observations),
    observations,
  };
}

export interface DedicatedHoldoutExecution {
  readonly registryPath: string;
  readonly artifactHash: string;
  readonly result: FinalHoldoutResult;
}

export function executeDedicatedHoldout(
  artifact: FrozenHoldoutArtifact,
  model: FrozenHoldoutModel,
  registryPath = "research/registry/final-holdout.execution.json",
): DedicatedHoldoutExecution {
  if (existsSync(registryPath)) throw new Error("Final holdout has already been executed");
  if (hashHoldoutObservations(artifact.observations) !== artifact.contentHash) {
    throw new Error("Holdout artifact hash mismatch");
  }
  const result = runFinalHoldout(
    artifact.observations,
    {
      start: HOLDOUT_START,
      end: HOLDOUT_END,
      modelVersion: model.version,
      modelTrainingEnd: "2026-01-01T00:00:00.000Z",
    },
    model,
  );
  mkdirSync(registryPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  writeFileSync(registryPath, JSON.stringify({
    status: "COMPLETED",
    protocol: "ADR-0002",
    methodologyVersion: result.methodologyVersion,
    executedAt: new Date().toISOString(),
    artifactHash: artifact.contentHash,
    modelVersion: result.modelVersion,
    modelTrainingEnd: result.modelTrainingEnd,
    holdoutStart: result.holdoutStart,
    holdoutEnd: result.holdoutEnd,
    result,
  }, null, 2) + String.fromCharCode(10));
  return { registryPath, artifactHash: artifact.contentHash, result };
}

export function loadFrozenHoldoutArtifact(path: string): FrozenHoldoutArtifact {
  const artifact = JSON.parse(readFileSync(path, "utf8")) as FrozenHoldoutArtifact;
  if (artifact.start !== HOLDOUT_START || artifact.end !== HOLDOUT_END) throw new Error("Holdout bounds mismatch");
  if (artifact.artifactVersion !== "holdout-observations.v1") throw new Error("Holdout artifact version mismatch");
  if (hashHoldoutObservations(artifact.observations) !== artifact.contentHash) throw new Error("Holdout artifact hash mismatch");
  return artifact;
}
