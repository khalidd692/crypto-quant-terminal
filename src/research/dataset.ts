import { createHash } from "node:crypto";
import type { DatasetVersion, MarketDataPoint } from "../domain/types.js";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function hashDataset(points: readonly MarketDataPoint[]): string {
  return createHash("sha256").update(canonical(points)).digest("hex");
}

export function createDatasetVersion(
  points: readonly MarketDataPoint[],
  sourceIds: readonly string[],
  methodologyVersion: string,
  createdAt: string,
): DatasetVersion {
  if (points.length === 0) throw new Error("Cannot version an empty dataset");
  const ordered = [...points].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) throw new Error("Cannot version an empty dataset");
  return {
    datasetVersion: `sha256:${hashDataset(ordered)}`,
    createdAt: createdAt as DatasetVersion["createdAt"],
    sourceIds: [...sourceIds],
    coverageStart: first.eventTime,
    coverageEnd: last.eventTime,
    methodologyVersion,
    immutable: true,
  };
}
