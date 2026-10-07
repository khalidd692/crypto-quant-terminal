import { createHash } from "node:crypto";
import type { MarketDataPoint } from "../domain/types.js";

export const HOLDOUT_START = "2026-01-01T00:00:00.000Z";
export const HOLDOUT_END = "2026-10-01T00:00:00.000Z";

export interface HoldoutDatasetArtifact {
  readonly artifactVersion: "holdout-dataset.v1";
  readonly start: typeof HOLDOUT_START;
  readonly end: typeof HOLDOUT_END;
  readonly contentHash: string;
  readonly points: readonly MarketDataPoint[];
}

export function hashHoldoutPoints(points: readonly MarketDataPoint[]): string {
  const payload = points.map((point) => JSON.stringify([
    point.instrumentId, point.eventTime, point.availableTime, point.open, point.high,
    point.low, point.close, point.volume, point.dataQuality, point.sourceId,
  ])).join("\n") + (points.length ? "\n" : "");
  return "sha256:" + createHash("sha256").update(payload).digest("hex");
}

export function createHoldoutDatasetArtifact(points: readonly MarketDataPoint[]): HoldoutDatasetArtifact {
  const start = Date.parse(HOLDOUT_START);
  const end = Date.parse(HOLDOUT_END);
  for (const point of points) {
    const event = Date.parse(point.eventTime);
    if (!Number.isFinite(event) || event < start || event >= end) {
      throw new Error("Holdout artifact timestamp outside frozen UTC interval");
    }
  }
  return {
    artifactVersion: "holdout-dataset.v1",
    start: HOLDOUT_START,
    end: HOLDOUT_END,
    contentHash: hashHoldoutPoints(points),
    points,
  };
}
