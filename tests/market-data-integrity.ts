import { validateMarketDataSeries } from "../src/domain/gaps.js";

const base = Array.from({ length: 5 }, (_, i) => ({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
  availableTime: new Date(Date.UTC(2026, 0, 1, i)).toISOString() as any,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
  dataQuality: "complete" as const,
  sourceId: `fixture:${i}`,
}));

const valid = validateMarketDataSeries(base, 60 * 60 * 1000);
if (!valid.valid || valid.gaps.length !== 0) throw new Error("Valid fixture rejected");

const broken = [...base];
(broken as any)[2] = { ...broken[2], high: 90 };
const invalid = validateMarketDataSeries(broken, 60 * 60 * 1000);
if (invalid.valid || invalid.invalidRows !== 1) throw new Error("Invalid OHLC fixture accepted");

const duplicate = [...base, base[4]];
const duplicated = validateMarketDataSeries(duplicate, 60 * 60 * 1000);
if (duplicated.valid || duplicated.duplicateEventTimes !== 1) throw new Error("Duplicate fixture accepted");
