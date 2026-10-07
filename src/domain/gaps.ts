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


export interface MarketDataIntegrity {
  readonly valid: boolean;
  readonly duplicateEventTimes: number;
  readonly invalidRows: number;
  readonly nonMonotonicRows: number;
  readonly gaps: readonly Gap[];
}

export function validateMarketDataSeries(
  points: readonly MarketDataPoint[],
  expectedIntervalMs: number,
): MarketDataIntegrity {
  const gaps = detectTimeGaps(points, expectedIntervalMs);
  let duplicateEventTimes = 0;
  let invalidRows = 0;
  let nonMonotonicRows = 0;
  const seen = new Set<string>();

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    if (seen.has(point.eventTime)) duplicateEventTimes += 1;
    seen.add(point.eventTime);
    if (!(point.high >= Math.max(point.open, point.close)) || !(point.low <= Math.min(point.open, point.close)) ||
        !(point.low <= point.high) || !Number.isFinite(point.volume) || point.volume < 0 ||
        !Number.isFinite(point.open) || !Number.isFinite(point.high) || !Number.isFinite(point.low) || !Number.isFinite(point.close)) {
      invalidRows += 1;
    }
    const previous = points[i - 1];
    if (previous && Date.parse(point.eventTime) <= Date.parse(previous.eventTime)) nonMonotonicRows += 1;
  }

  return {
    valid: duplicateEventTimes === 0 && invalidRows === 0 && nonMonotonicRows === 0,
    duplicateEventTimes,
    invalidRows,
    nonMonotonicRows,
    gaps,
  };
}
