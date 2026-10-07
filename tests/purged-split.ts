import { splitObservations } from "../src/backtest/purged-split.js";
import type { ResearchObservation } from "../src/research/observation-ledger.js";

const make = (hour: number, horizonHour: number): ResearchObservation => {
  const event = new Date(Date.UTC(2026, 0, 1, hour)).toISOString();
  const horizon = new Date(Date.UTC(2026, 0, 1, horizonHour)).toISOString();
  return {
    observationId: `obs-${hour}`,
    instrumentId: "TEST",
    eventTime: event,
    availableTime: event,
    datasetVersion: "sha256:test",
    featureDefinitionVersions: [],
    featureVersionPolicy: "test",
    featureSnapshot: [],
    dataAvailabilityRule: "availableTime <= decisionTime",
    setupId: null,
    side: null,
    regimeLabel: null,
    entryReferencePrice: 100,
    horizonCandles: 1,
    horizonEndTime: horizon,
    targetR: null,
    invalidationR: null,
    outcome: null,
    eligible: false,
    exclusionReason: "NO_BASELINE_SETUP",
  };
};

const observations = [
  make(1, 2),
  make(2, 6),
  make(3, 4),
  make(5, 5),
  make(6, 6),
  make(7, 7),
  make(8, 8),
];

const split = splitObservations(observations, {
  trainEnd: new Date(Date.UTC(2026, 0, 1, 5)).toISOString(),
  testStart: new Date(Date.UTC(2026, 0, 1, 6)).toISOString(),
  testEnd: new Date(Date.UTC(2026, 0, 1, 7)).toISOString(),
  embargoDurationMs: 60 * 60 * 1000,
  rationale: "1-candle outcomes can overlap the test boundary",
});

if (split.test.length !== 1) throw new Error("Unexpected test count");
if (split.purged.length !== 1) throw new Error("Overlapping training observation was not purged");
if (split.train.length !== 2) throw new Error("Non-overlapping training observations missing");
if (split.embargoed.length !== 1) throw new Error("Embargoed observation missing");

const lateAvailable = make(4, 4);
const late = { ...lateAvailable, availableTime: new Date(Date.UTC(2026, 0, 1, 5, 30)).toISOString() };
const availabilitySplit = splitObservations([late], {
  trainEnd: new Date(Date.UTC(2026, 0, 1, 5)).toISOString(),
  testStart: new Date(Date.UTC(2026, 0, 1, 6)).toISOString(),
  testEnd: new Date(Date.UTC(2026, 0, 1, 7)).toISOString(),
  embargoDurationMs: 0,
  rationale: "availability must gate decision-time membership",
});
if (availabilitySplit.train.length !== 0 || availabilitySplit.test.length !== 0) {
  throw new Error("Unavailable observation incorrectly entered train/test");
}
