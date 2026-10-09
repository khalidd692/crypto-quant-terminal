import assert from "node:assert/strict";
import { calculateAnchoredVwap } from "../src/surveillance/anchored-vwap.js";
import type { MarketDataPoint } from "../src/domain/types.js";
const rows:MarketDataPoint[]=[
 {instrumentId:"TEL-USDT",eventTime:"2026-10-09T10:00:00.000Z" as MarketDataPoint["eventTime"],availableTime:"2026-10-09T10:01:00.000Z" as MarketDataPoint["availableTime"],open:1,high:1.2,low:.8,close:1,volume:10,dataQuality:"complete",sourceId:"fixture"},
 {instrumentId:"TEL-USDT",eventTime:"2026-10-09T11:00:00.000Z" as MarketDataPoint["eventTime"],availableTime:"2026-10-09T11:01:00.000Z" as MarketDataPoint["availableTime"],open:2,high:2.2,low:1.8,close:2,volume:10,dataQuality:"complete",sourceId:"fixture"}
];
const result=calculateAnchoredVwap(rows,"2026-10-09T10:00:00.000Z","2026-10-09T12:00:00.000Z");
assert.equal(result.status,"OK");assert.equal(result.observations,2);assert.ok(result.value!==null&&result.value>1&&result.value<2);
assert.equal(calculateAnchoredVwap(rows,null,"2026-10-09T12:00:00.000Z").status,"UNAVAILABLE");
assert.equal(calculateAnchoredVwap(rows,"2026-10-10T00:00:00.000Z","2026-10-09T12:00:00.000Z").status,"UNAVAILABLE");
console.log("Anchored VWAP: PASS (point-in-time anchor and fail-closed behavior)");
