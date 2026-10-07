import { buildOutcomeDiagnostics } from "../src/research/outcome-diagnostics.js";
import type { ResearchObservation } from "../src/research/observation-ledger.js";
import type { ISO8601 } from "../src/domain/types.js";

const feature = {
  featureId: "volatility.atr_ratio",
  featureVersion: "test",
  instrumentId: "TEST",
  eventTime: "2026-01-01T00:00:00.000Z" as ISO8601,
  availableTime: "2026-01-01T00:00:00.000Z" as ISO8601,
  value: 0.01,
  inputDataVersion: "fixture",
};

function observation(
  label: "TARGET" | "INVALIDATION" | "TIME_EXIT",
  returnFraction: number,
  feesReturn: number,
  slippageReturn: number,
  realizedR: number,
): ResearchObservation {
  return {
    observationId: `obs-${label}`,
    instrumentId: "TEST",
    eventTime: "2026-01-01T00:00:00.000Z",
    availableTime: "2026-01-01T00:00:00.000Z",
    datasetVersion: "fixture",
    featureDefinitionVersions: ["test@1"],
    featureVersionPolicy: "test",
    featureSnapshot: [feature],
    setupId: "fixture",
    side: "LONG",
    regimeLabel: null,
    entryReferencePrice: 100,
    horizonCandles: 8,
    horizonEndTime: "2026-01-01T08:00:00.000Z" as ISO8601,
    targetR: 1.5,
    invalidationR: 1,
    outcome: {
      label,
      targetHit: label === "TARGET",
      invalidationHit: label === "INVALIDATION",
      timeExit: label === "TIME_EXIT",
      intrabarAmbiguous: false,
      mfeR: 0,
      maeR: 0,
      realizedR,
      returnFraction,
      exitPrice: 100,
      exitEventTime: "2026-01-01T08:00:00.000Z",
      feesReturn,
      slippageReturn,
      fundingReturn: 0,
    },
    dataAvailabilityRule: "fixture",
    eligible: true,
    exclusionReason: null,
  };
}

const diagnostics = buildOutcomeDiagnostics([
  observation("TARGET", 0.014, 0.002, 0.001, 1.1),
  observation("INVALIDATION", -0.011, 0.002, -0.001, -1.2),
  observation("TIME_EXIT", 0.001, 0.002, -0.001, -0.1),
  {
    ...observation("TIME_EXIT", 0, 0, 0, 0),
    outcome: {
      ...observation("TIME_EXIT", 0, 0, 0, 0).outcome!,
      intrabarAmbiguous: true,
      label: "AMBIGUOUS",
    },
  },
  {
    ...observation("TIME_EXIT", 0, 0, 0, 0),
    eligible: false,
    outcome: null,
    exclusionReason: "NO_BASELINE_SETUP",
  },
]);

if (diagnostics.totalObservations !== 5) throw new Error("Diagnostic total mismatch");
if (diagnostics.cleanEligibleObservations !== 3) throw new Error("Diagnostic clean count mismatch");
if (diagnostics.excludedAmbiguous !== 1) throw new Error("Ambiguous exclusion mismatch");
if (diagnostics.excludedOther !== 1) throw new Error("Other exclusion mismatch");
if (diagnostics.exclusionReasons.NO_BASELINE_SETUP !== 1) throw new Error("Exclusion reason mismatch");
if (diagnostics.states.TARGET.count !== 1 || diagnostics.states.INVALIDATION.count !== 1 || diagnostics.states.TIME_EXIT.count !== 1) {
  throw new Error("State counts mismatch");
}
if (diagnostics.states.TARGET.meanGrossR === null || diagnostics.states.INVALIDATION.meanGrossR === null || diagnostics.states.TIME_EXIT.meanGrossR === null) {
  throw new Error("Gross state means should be present");
}
if (diagnostics.states.TARGET.meanNetR !== 1.1) throw new Error("Net TARGET mean mismatch");
if (diagnostics.states.INVALIDATION.meanNetR !== -1.2) throw new Error("Net INVALIDATION mean mismatch");
if (diagnostics.states.TIME_EXIT.meanNetR !== -0.1) throw new Error("Net TIME_EXIT mean mismatch");

console.log("research-outcome-diagnostics: ok");
