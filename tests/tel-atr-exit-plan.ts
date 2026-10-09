import assert from "node:assert/strict";
import { calculateTelAtrExitPlan, TEL_ATR_EXIT_DEFAULTS } from "../src/risk/tel-atr-exit-plan.js";

const base = {entryPrice:1,entryAtr:.04,currentPrice:1.05,currentAtr:.03,highestSinceEntry:1.1,
  entryAt:"2026-10-01T00:00:00.000Z",asOf:"2026-10-03T00:00:00.000Z",
  target1Reached:false,previousStop:null,remainingFraction:1};
const plan=calculateTelAtrExitPlan(base);
assert.equal(plan.catastropheStop,.9);
assert.equal(plan.target1,1.08);
assert.equal(plan.target2,1.12);
assert.equal(plan.reduceFractionNow,0);
const target1=calculateTelAtrExitPlan({...base,currentPrice:1.09});
assert.equal(target1.reduceFractionNow,.5);
const time=calculateTelAtrExitPlan({...base,asOf:"2026-10-07T00:00:00.000Z"});
assert.equal(time.reduceFractionNow,.25);
const raised=calculateTelAtrExitPlan({...base,target1Reached:true,remainingFraction:.5,previousStop:.95,highestSinceEntry:1.2,currentAtr:.05});
assert.ok(raised.trailingStop!==null && raised.trailingStop>=.95);
assert.ok(raised.stopChange===null || raised.stopChange.next>raised.stopChange.previous);
const neverLower=calculateTelAtrExitPlan({...base,target1Reached:true,remainingFraction:.5,previousStop:1.05,highestSinceEntry:1.1,currentAtr:.1});
assert.equal(neverLower.trailingStop,1.05);
assert.equal(neverLower.stopChange,null);
assert.equal(TEL_ATR_EXIT_DEFAULTS.version,"tel-atr-exit.v1");
console.log("TEL ATR exit plan: PASS (fixed stop, ATR targets, time reduction, favorable-only trailing stop)");
