import type { MarketDataPoint } from "./types.js";

export interface Gap {
  readonly previousEventTime: string;
  readonly nextEventTime: string;
  readonly missingDurationMs: number;
}

export function detectTimeGaps(points: readonly MarketDataPoint[], expectedIntervalMs: number): readonly Gap[] {
  if (expectedIntervalMs <= 0) throw new Error("expectedIntervalMs must be positive");
  const gaps: Gap[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const next = points[i];
    if (!previous || !next) continue;
    const delta = Date.parse(next.eventTime) - Date.parse(previous.eventTime);
    if (delta > expectedIntervalMs) {
      gaps.push({
        previousEventTime: previous.eventTime,
        nextEventTime: next.eventTime,
        missingDurationMs: delta - expectedIntervalMs,
      });
    }
  }
  return gaps;
}
