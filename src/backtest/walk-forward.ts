export interface WalkForwardWindow {
  readonly id: string;
  readonly trainStart: string;
  readonly trainEnd: string;
  readonly testStart: string;
  readonly testEnd: string;
}

export interface WalkForwardConfig {
  readonly start: string;
  readonly end: string;
  readonly trainDurationMs: number;
  readonly testDurationMs: number;
  readonly stepDurationMs: number;
  readonly purgeDurationMs: number;
  readonly embargoDurationMs: number;
}

export function buildWalkForwardWindows(config: WalkForwardConfig): readonly WalkForwardWindow[] {
  const start = Date.parse(config.start);
  const end = Date.parse(config.end);
  if (![start, end].every(Number.isFinite) || start >= end) throw new Error("Invalid walk-forward bounds");
  if (config.trainDurationMs <= 0 || config.testDurationMs <= 0 || config.stepDurationMs <= 0) {
    throw new Error("Walk-forward durations must be positive");
  }
  if (config.purgeDurationMs < 0 || config.embargoDurationMs < 0) {
    throw new Error("Purge/embargo durations cannot be negative");
  }

  const windows: WalkForwardWindow[] = [];
  let cursor = start;
  let index = 0;
  while (cursor + config.trainDurationMs + config.purgeDurationMs + config.testDurationMs <= end) {
    const trainEnd = cursor + config.trainDurationMs;
    const testStart = trainEnd + config.purgeDurationMs;
    const testEnd = testStart + config.testDurationMs;
    if (testEnd > end) break;

    windows.push({
      id: `wf-${index}`,
      trainStart: new Date(cursor).toISOString(),
      trainEnd: new Date(trainEnd).toISOString(),
      testStart: new Date(testStart).toISOString(),
      testEnd: new Date(testEnd).toISOString(),
    });
    cursor += config.stepDurationMs;
    index += 1;
  }

  if (windows.length === 0) throw new Error("Walk-forward configuration produces no windows");
  return windows;
}
