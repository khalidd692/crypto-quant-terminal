import { loadResearchPoints } from "../src/research/research-dataset-loader.js";

const point = (eventTime: string) => ({
  instrumentId: "BTCUSDT",
  eventTime,
  availableTime: eventTime,
  open: 1,
  high: 1,
  low: 1,
  close: 1,
  volume: 1,
  dataQuality: "complete" as const,
  sourceId: "test",
});

loadResearchPoints([point("2025-12-31T23:59:59.999Z")]);

let rejected = false;
try {
  loadResearchPoints([point("2026-01-01T00:00:00.000Z")]);
} catch (error) {
  rejected = error instanceof Error && error.message.includes("rejects holdout timestamp");
}
if (!rejected) throw new Error("Research loader must reject holdout timestamps");
