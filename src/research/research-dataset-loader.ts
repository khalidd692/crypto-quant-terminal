import type { MarketDataPoint } from "../domain/types.js";

export const RESEARCH_END_EXCLUSIVE = "2026-01-01T00:00:00.000Z";

export function assertResearchTimestamp(eventTime: string): void {
  const timestamp = Date.parse(eventTime);
  const cutoff = Date.parse(RESEARCH_END_EXCLUSIVE);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid research timestamp: " + eventTime);
  if (timestamp >= cutoff) throw new Error("Research dataset rejects holdout timestamp >= " + RESEARCH_END_EXCLUSIVE);
}

export function loadResearchPoints(points: readonly MarketDataPoint[]): readonly MarketDataPoint[] {
  for (const point of points) assertResearchTimestamp(point.eventTime);
  return points;
}
