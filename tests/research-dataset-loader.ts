import { loadResearchPoints } from "../src/research/research-dataset-loader.js";

const before = "2025-12-31T23:59:59.999Z";
const cutoff = "2026-01-01T00:00:00.000Z";
loadResearchPoints([{
  instrumentId: "BTCUSDT", eventTime: before, availableTime: before,
  open: 1, high: 1, low: 1, close: 1, volume: 1,
  dataQuality: "complete", sourceId: "test",
}]);
let rejected = false;
try {
  loadResearchPoints([{
    instrumentId: "BTCUSDT", eventTime: cutoff, availableTime: cutoff,
    open: 1, high: 1, low: 1, close: 1, volume: 1,
    dataQuality: "complete", sourceId: "holdout",
  }]);
} catch (error) {
  rejected = error instanceof Error && error.message.includes("rejects holdout timestamp");
}
if (!rejected) throw new Error("Research loader must reject timestamp >= 2026-01-01T00:00:00.000Z");
