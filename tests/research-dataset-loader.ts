import { loadResearchPoints } from "../src/research/research-dataset-loader.js";
import type { ISO8601, MarketDataPoint } from "../src/domain/types.js";

const point = (eventTime: string): MarketDataPoint => ({
  instrumentId: "BTCUSDT",
  eventTime: eventTime as ISO8601,
  availableTime: eventTime as ISO8601,
  open: 1,
  high: 1,
  low: 1,
  close: 1,
  volume: 1,
  dataQuality: "complete",
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
