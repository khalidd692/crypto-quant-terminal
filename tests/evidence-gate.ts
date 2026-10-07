import { estimateBinomial } from "../src/statistics/binomial.js";
import { assessProbabilityEvidence } from "../src/statistics/evidence-gate.js";
import { assessMultistateEvidence } from "../src/statistics/multistate-evidence-gate.js";

const policy = { maxProbabilityIntervalWidth: 0.2, minimumLowerBoundEdge: 0 };

const uncertain = assessProbabilityEvidence(estimateBinomial(7, 10), 0.5, policy);
if (uncertain.sufficient || uncertain.reason !== "INTERVAL_TOO_WIDE") {
  throw new Error("Wide uncertainty must block evidence");
}

const strong = assessProbabilityEvidence(estimateBinomial(95, 100), 0.5, {
  maxProbabilityIntervalWidth: 0.2,
  minimumLowerBoundEdge: 0,
});
if (!strong.sufficient || strong.reason !== "SUFFICIENT") {
  throw new Error("Conservative probability edge should pass");
}

const insufficient = assessProbabilityEvidence(estimateBinomial(55, 100), 0.5, {
  maxProbabilityIntervalWidth: 0.2,
  minimumLowerBoundEdge: 0,
});
if (insufficient.sufficient || insufficient.reason !== "LOWER_BOUND_BELOW_BREAK_EVEN") {
  throw new Error("Lower confidence bound below break-even must block evidence");
}

if (assessProbabilityEvidence(null, 0.5, policy).reason !== "NO_ESTIMATE") {
  throw new Error("Missing estimate must block evidence");
}

console.log("evidence-gate: ok");

import { estimateOutcomeDistribution } from "../src/statistics/multi-outcome-probability.js";
import { createResearchObservation } from "../src/research/observation-ledger.js";
const makeOutcome = (hour: number, label: "TARGET" | "INVALIDATION") => createResearchObservation({
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(),
  availableTime: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(),
  datasetVersion: "sha256:test",
  featureDefinitionVersions: ["test.v1"],
  featureVersionPolicy: "test",
  featureSnapshot: [],
  regimeLabel: null,
  setupId: "setup.test",
  side: "LONG",
  entryReferencePrice: 100,
  horizonCandles: 2,
  horizonEndTime: new Date(Date.UTC(2026, 0, 1, hour + 2)).toISOString(),
  targetR: 1,
  invalidationR: 1,
  outcome: {
    label,
    targetHit: label === "TARGET",
    invalidationHit: label === "INVALIDATION",
    timeExit: false,
    intrabarAmbiguous: false,
    mfeR: 0,
    maeR: 0,
    realizedR: label === "TARGET" ? 1 : -1,
    returnFraction: 0,
    exitPrice: 100,
    exitEventTime: new Date(Date.UTC(2026, 0, 1, hour + 2)).toISOString(),
    feesReturn: 0,
    slippageReturn: 0,
    fundingReturn: 0,
  },
  dataAvailabilityRule: "test",
  eligible: true,
  exclusionReason: null,
});
const msEstimate = estimateOutcomeDistribution(
  [makeOutcome(0, "TARGET"), makeOutcome(1, "TARGET"), makeOutcome(2, "INVALIDATION"), makeOutcome(3, "INVALIDATION")],
  { setupId: "setup.test", side: "LONG" },
  "2026-01-01T06:00:00.000Z",
);
if (!msEstimate) throw new Error("Expected multistate estimate");
const adjustedGate = assessMultistateEvidence(msEstimate, { maxTargetIntervalWidth: 0.5, maxAmbiguousProbability: 1 });
if (adjustedGate.targetIntervalWidth !== msEstimate.probabilities.find((item) => item.event === "TARGET")?.adjustedUncertainty.interval.upper! - msEstimate.probabilities.find((item) => item.event === "TARGET")?.adjustedUncertainty.interval.lower!) {
  throw new Error("Evidence gate did not use adjusted interval");
}
