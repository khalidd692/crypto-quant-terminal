import assert from "node:assert/strict";
import {
  createTelExitPlan,
  evaluateTelExitActions,
  TEL_EXIT_POLICY,
  validateFavorableStopUpdate
} from "../src/surveillance/tel-exit-plan.js";

const plan = createTelExitPlan(1, 0.05, 90, "2026-10-09T00:00:00.000Z");
assert.equal(plan.catastropheStop, 0.9);
assert.equal(plan.target1, 1.075);
assert.equal(plan.target2, 1.125);
assert.equal(plan.policyVersion, "tel-spot-exit.v1");

const target1 = evaluateTelExitActions(plan, {
  remainingQuantity: 90, target1Reached: false, target2Reached: false,
  timeReductionApplied: false, bestPriceSinceTarget2: null, currentTrailingStop: null
}, 1.08, "2026-10-09T01:00:00.000Z", 0.05);
assert.ok(target1.some(a => a.type === "REDUCE" && a.reason === "TARGET_1" && a.quantity === 30));

const timed = evaluateTelExitActions(plan, {
  remainingQuantity: 90, target1Reached: false, target2Reached: false,
  timeReductionApplied: false, bestPriceSinceTarget2: null, currentTrailingStop: null
}, 1, "2026-10-16T00:00:00.000Z", 0.05);
assert.ok(timed.some(a => a.type === "REDUCE" && a.reason === "TIME_REDUCTION" && a.quantity === 30));

const catastrophe = evaluateTelExitActions(plan, {
  remainingQuantity: 90, target1Reached: false, target2Reached: false,
  timeReductionApplied: false, bestPriceSinceTarget2: null, currentTrailingStop: null
}, 0.89, "2026-10-10T00:00:00.000Z", 0.05);
assert.deepEqual(catastrophe, [{ type: "CATASTROPHE_STOP", stopPrice: 0.9 }]);

const trail = evaluateTelExitActions(plan, {
  remainingQuantity: 30, target1Reached: true, target2Reached: true,
  timeReductionApplied: false, bestPriceSinceTarget2: 1.2, currentTrailingStop: 1.05
}, 1.18, "2026-10-10T00:00:00.000Z", 0.05);
assert.ok(trail.some(a => a.type === "UPDATE_TRAILING_STOP" && a.stopPrice === 1.1));
assert.throws(() => validateFavorableStopUpdate(1.05, 1.04), /only move in the favorable direction/);
assert.doesNotThrow(() => validateFavorableStopUpdate(1.05, 1.06));
assert.throws(() => createTelExitPlan(1, 1, 10, "2026-10-09T00:00:00.000Z"), /above zero/);
console.log("TEL ATR exit plan: PASS", TEL_EXIT_POLICY.version, "— calculations only; no exchange orders");
