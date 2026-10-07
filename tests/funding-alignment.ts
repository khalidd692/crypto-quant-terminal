import { assessFunding } from "../src/research/funding.js";
import type { ISO8601 } from "../src/domain/types.js";

const rates = [
  { symbol: "BTCUSDT", fundingRate: 0.001, fundingTime: "2026-01-01T08:00:00.000Z" as ISO8601, markPrice: null, rateType: null },
  { symbol: "BTCUSDT", fundingRate: -0.0005, fundingTime: "2026-01-01T16:00:00.000Z" as ISO8601, markPrice: null, rateType: null },
  { symbol: "BTCUSDT", fundingRate: 0.002, fundingTime: "2026-01-02T00:00:00.000Z" as ISO8601, markPrice: null, rateType: null },
];

const long = assessFunding("LONG", "2026-01-01T00:00:00.000Z", "2026-01-01T20:00:00.000Z", rates);
if (long.eventsApplied !== 2) throw new Error("Funding interval selection failed");
if (long.paymentReturnFraction !== -0.0005) throw new Error("Long funding sign mismatch");

const short = assessFunding("SHORT", "2026-01-01T00:00:00.000Z", "2026-01-01T20:00:00.000Z", rates);
if (short.paymentReturnFraction !== 0.0005) throw new Error("Short funding sign mismatch");

const boundary = assessFunding("LONG", "2026-01-01T08:00:00.000Z", "2026-01-01T16:00:00.000Z", rates);
if (boundary.eventsApplied !== 1) throw new Error("Entry boundary funding must not be charged");
if (boundary.paymentReturnFraction !== 0.0005) throw new Error("Exit boundary funding must be included");
