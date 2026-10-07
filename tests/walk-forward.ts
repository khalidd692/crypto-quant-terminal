import { buildWalkForwardWindows } from "../src/backtest/walk-forward.js";

const windows = buildWalkForwardWindows({
  start: "2020-01-01T00:00:00Z",
  end: "2025-01-01T00:00:00Z",
  trainDurationMs: 365 * 24 * 3600 * 1000,
  testDurationMs: 90 * 24 * 3600 * 1000,
  stepDurationMs: 90 * 24 * 3600 * 1000,
  purgeDurationMs: 7 * 24 * 3600 * 1000,
  embargoDurationMs: 2 * 24 * 3600 * 1000,
});
const first = windows[0];
if (!first) throw new Error("Walk-forward produced no windows");
if (Date.parse(first.trainEnd) >= Date.parse(first.testStart)) throw new Error("Purge/embargo separation invalid");
