import { validateMarketData } from "../src/domain/data.js";
import { simpleMovingAverage, exponentialMovingAverage, rsi } from "../src/features/indicators.js";
import { hashDataset } from "../src/research/dataset.js";

const points = Array.from({ length: 60 }, (_, i) => ({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
  availableTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100 + i,
  volume: 1000 + i,
  dataQuality: "complete" as const,
  sourceId: "fixture",
}));
const report = validateMarketData(points);
if (!report.valid) throw new Error("Fixture should validate");
if (simpleMovingAverage([1,2,3,4], 4) !== 2.5) throw new Error("SMA mismatch");
if (exponentialMovingAverage([1,2,3,4], 4) !== 2.5) throw new Error("EMA seed mismatch");
if (rsi([1,2,3,4,5], 4) !== 100) throw new Error("RSI mismatch");
if (hashDataset(points) !== hashDataset(points)) throw new Error("Dataset hash must be deterministic");
