import { estimateBinomial } from "../src/statistics/binomial.js";
import { assessProbabilityEvidence } from "../src/statistics/evidence-gate.js";

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
