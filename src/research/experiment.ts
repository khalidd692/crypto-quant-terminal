import { createHash } from "node:crypto";
import type { ResearchReport } from "./report.js";

export interface ExperimentSpec {
  readonly experimentId: string;
  readonly experimentVersion: string;
  readonly datasetVersion: string;
  readonly codeVersion: string;
  readonly methodologyVersion: string;
  readonly featureDefinitionVersions: readonly string[];
  readonly setupVersion: string;
  readonly outcomeProtocolVersion: string;
  readonly trainingWindow: { readonly start: string; readonly end: string };
  readonly validationWindow?: { readonly start: string; readonly end: string };
  readonly testWindow?: { readonly start: string; readonly end: string };
  readonly finalHoldoutWindow?: { readonly start: string; readonly end: string };
  readonly configuration: Readonly<Record<string, string | number | boolean>>;
}

export interface ExperimentArtifact {
  readonly artifactVersion: "experiment-artifact.v1";
  readonly spec: ExperimentSpec;
  readonly report: ResearchReport;
  readonly createdAt: string;
  readonly artifactHash: string;
  readonly immutable: true;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
    .join(",") + "}";
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function createExperimentArtifact(
  spec: ExperimentSpec,
  report: ResearchReport,
  createdAt: string,
): ExperimentArtifact {
  if (!spec.experimentId.trim()) throw new Error("experimentId is required");
  if (!spec.datasetVersion.startsWith("sha256:")) throw new Error("datasetVersion must be a content hash");
  if (!spec.codeVersion.trim()) throw new Error("codeVersion is required");
  if (!spec.outcomeProtocolVersion.trim()) throw new Error("outcomeProtocolVersion is required");
  if (!spec.featureDefinitionVersions.length) throw new Error("At least one feature definition version is required");

  const payload = { artifactVersion: "experiment-artifact.v1", spec, report, createdAt };
  return {
    artifactVersion: "experiment-artifact.v1",
    spec,
    report,
    createdAt,
    artifactHash: "sha256:" + hash(payload),
    immutable: true,
  };
}
