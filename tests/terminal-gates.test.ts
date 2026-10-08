import assert from "node:assert/strict";
import { evaluateDecisionPipeline } from "../src/decision/pipeline.js";

const base = {
  side: "LONG" as const,
  outcomeDistribution: null,
  evidencePolicy: { maxTargetIntervalWidth: 0.5, maxAmbiguousProbability: 0.25 },
  minExpectedValueR: 0,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
};

assert.equal(evaluateDecisionPipeline(base).decision, "INSUFFICIENT_EVIDENCE");
assert.equal(evaluateDecisionPipeline({ ...base, dataValid: false }).decision, "NO_TRADE");
assert.equal(evaluateDecisionPipeline({ ...base, dataFresh: false }).decision, "NO_TRADE");
assert.equal(evaluateDecisionPipeline({ ...base, liquidityPassed: false }).decision, "NO_TRADE");
assert.equal(evaluateDecisionPipeline({ ...base, portfolioRiskAllowed: false }).decision, "NO_TRADE");
assert.equal(evaluateDecisionPipeline({ ...base, invalidationDefined: false }).decision, "NO_TRADE");

console.log("terminal-gates: ok");
