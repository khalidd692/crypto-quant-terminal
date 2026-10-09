import assert from "node:assert/strict";
import type { MarketDataPoint } from "../src/domain/types.js";
import { latestSwingLowAnchoredVwap } from "../src/features/monitor-indicators.js";

function point(i: number, low = 0.98): MarketDataPoint {
  return {
    instrumentId: "TEL-USDT",
    eventTime: new Date(Date.parse("2026-10-01T00:00:00.000Z") + i * 3_600_000).toISOString() as MarketDataPoint["eventTime"],
    availableTime: new Date(Date.parse("2026-10-01T00:00:05.000Z") + i * 3_600_000).toISOString() as MarketDataPoint["availableTime"],
    open: 1,
    high: 1.02,
    low,
    close: 1,
    volume: 100,
    dataQuality: "complete",
    sourceId: "KUCOIN_SPOT_KLINES_1H",
  };
}

const points = Array.from({ length: 12 }, (_, i) => point(i));
points[4] = point(4, 0.7);
points[8] = point(8, 0.8);
const anchored = latestSwingLowAnchoredVwap(points);
assert.ok(anchored);
assert.equal(anchored.anchorIndex, 8, "must choose the latest confirmed swing low");
assert.equal(anchored.anchorEventTime, points[8]?.eventTime);
assert.ok(anchored.value > 0.8 && anchored.value < 1.02);

const noConfirmedLow = Array.from({ length: 12 }, (_, i) => point(i, 0.98 + i * 0.001));
assert.equal(latestSwingLowAnchoredVwap(noConfirmedLow), null);

const unconfirmedNewLow = [...points];
unconfirmedNewLow[11] = point(11, 0.5);
const noLookAhead = latestSwingLowAnchoredVwap(unconfirmedNewLow);
assert.ok(noLookAhead);
assert.equal(noLookAhead.anchorIndex, 4, "a pivot requiring future confirmation must not be used");

const invalidVolume = [...points];
invalidVolume[9] = { ...point(9), volume: -1 };
assert.equal(latestSwingLowAnchoredVwap(invalidVolume), null, "invalid volume must fail closed");

console.log("Anchored VWAP: PASS (latest confirmed pivot, bounded confirmation, missing/invalid data)");
