import assert from "node:assert/strict";
import { estimateBinomial } from "../src/statistics/binomial.js";
import { evaluateDecisionPipeline } from "../src/decision/pipeline.js";

const estimate = estimateBinomial(95, 100);
const result = evaluateDecisionPipeline({
  side: "LONG",
  probabilityEstimate: estimate,
  breakEvenProbability: 0.5,
  evidencePolicy: { maxProbabilityIntervalWidth: 0.2, minimumLowerBoundEdge: 0 },
  outcomePayoffsR: [
    { event: "TARGET", probability: 0.95, payoffR: 1 },
    { event: "INVALIDATION", probability: 0.05, payoffR: -1 },
  ],
  feesR: 0.02,
  slippageR: 0.01,
  fundingR: 0.01,
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(result.decision, "LONG");
assert.ok(result.expectancy);
assert.ok(result.expectancy.expectedValue > 0.1);

const blocked = evaluateDecisionPipeline({
  side: "LONG",
  probabilityEstimate: estimateBinomial(55, 100),
  breakEvenProbability: 0.5,
  evidencePolicy: { maxProbabilityIntervalWidth: 0.2, minimumLowerBoundEdge: 0 },
  outcomePayoffsR: [
    { event: "TARGET", probability: 0.55, payoffR: 1 },
    { event: "INVALIDATION", probability: 0.45, payoffR: -1 },
  ],
  feesR: 0,
  slippageR: 0,
  fundingR: 0,
  minExpectedValueR: 0,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(blocked.decision, "INSUFFICIENT_EVIDENCE");

const lowExpectancy = evaluateDecisionPipeline({
  side: "LONG",
  probabilityEstimate: estimate,
  breakEvenProbability: 0.5,
  evidencePolicy: { maxProbabilityIntervalWidth: 0.2, minimumLowerBoundEdge: 0 },
  outcomePayoffsR: [
    { event: "TARGET", probability: 0.95, payoffR: 1 },
    { event: "INVALIDATION", probability: 0.05, payoffR: -1 },
  ],
  feesR: 0,
  slippageR: 0,
  fundingR: 0,
  minExpectedValueR: 1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: true,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(lowExpectancy.decision, "WAIT");
assert.deepEqual(lowExpectancy.vetoReasons, ["expectancy_below_threshold"]);

const hardVeto = evaluateDecisionPipeline({
  side: "LONG",
  probabilityEstimate: estimate,
  breakEvenProbability: 0.5,
  evidencePolicy: { maxProbabilityIntervalWidth: 0.2, minimumLowerBoundEdge: 0 },
  outcomePayoffsR: [
    { event: "TARGET", probability: 0.95, payoffR: 1 },
    { event: "INVALIDATION", probability: 0.05, payoffR: -1 },
  ],
  feesR: 0,
  slippageR: 0,
  fundingR: 0,
  minExpectedValueR: 0.1,
  dataValid: true,
  dataFresh: true,
  liquidityPassed: false,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
assert.equal(hardVeto.decision, "NO_TRADE");
assert.deepEqual(hardVeto.vetoReasons, ["liquidity_gate_failed"]);

console.log("decision-pipeline: ok");
