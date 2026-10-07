import { estimateConditionalProbability } from "../src/statistics/empirical-probability.js";
import type { ResearchObservation } from "../src/research/observation-ledger.js";

const make = (hour: number, target: boolean, timeExit = false): ResearchObservation => {
  const eventTime = new Date(Date.UTC(2026, 0, 1, hour)).toISOString();
  return {
    observationId: `o-${hour}`,
    instrumentId: "BTCUSDT",
    eventTime,
    availableTime: eventTime,
    datasetVersion: "sha256:test",
    featureDefinitionVersions: [],
    featureVersionPolicy: "test",
    featureSnapshot: [],
    setupId: "baseline.trend.v1",
    side: "LONG",
    entryReferencePrice: 100,
    horizonCandles: 4,
    horizonEndTime: eventTime,
    targetR: 1.5,
    invalidationR: 1,
    outcome: {
      label: timeExit ? "TIME_EXIT" : target ? "TARGET" : "INVALIDATION",
      targetHit: target,
      invalidationHit: !target && !timeExit,
      timeExit,
      intrabarAmbiguous: false,
      mfeR: target ? 2 : 0,
      maeR: target ? -0.2 : -1,
      realizedR: target ? 1 : -1,
      returnFraction: 0,
      exitPrice: 100,
      exitEventTime: eventTime,
      feesReturn: 0,
      slippageReturn: 0,
      fundingReturn: 0,
    },
    dataAvailabilityRule: "test",
    eligible: true,
    exclusionReason: null,
  };
};

const observations = [
  make(1, true),
  make(2, true),
  make(3, false),
  make(4, false),
  make(5, true, true),
  make(8, true),
];

const estimate = estimateConditionalProbability(observations, {
  setupId: "baseline.trend.v1",
  side: "LONG",
}, new Date(Date.UTC(2026, 0, 1, 6)).toISOString());

if (!estimate) throw new Error("Expected probability estimate");
if (estimate.estimate.successes !== 2 || estimate.estimate.observations !== 4) throw new Error("Training selection mismatch");
if (estimate.estimate.probability !== 0.5) throw new Error("Empirical probability mismatch");
if (estimate.excludedTimeExits !== 1) throw new Error("Time exit exclusion mismatch");
