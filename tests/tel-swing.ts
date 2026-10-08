import assert from "node:assert/strict";
import { calculateSpotSwingRisk, assessBtcFilter, buildSwingDecision, analyzePastEntries, P0_ENTRY_POLICY } from "../src/surveillance/tel-swing.js";
const risk=calculateSpotSwingRisk({swingCapitalQuote:10000,entryPrice:100,stopPrice:90,maxRiskPerTradePct:P0_ENTRY_POLICY.maxRiskPerTradePct,feePct:P0_ENTRY_POLICY.roundTripFeePct,slippagePct:P0_ENTRY_POLICY.slippagePct,openSwingPositions:0,maxPositions:P0_ENTRY_POLICY.maxPositions,monthlyLossQuote:0,maxMonthlyLossPct:P0_ENTRY_POLICY.maxMonthlyLossPct,atr:5,atrStopMultiple:P0_ENTRY_POLICY.atrStopMultiple});
assert.equal(risk.allowed,true); assert.equal(risk.tranches.length,3); assert.ok(Math.abs(risk.maxLossQuote-50)<1e-9);
const atrBlocked=calculateSpotSwingRisk({...riskInput(risk),entryPrice:100,stopPrice:98,atr:2,atrStopMultiple:1.5});
function riskInput(_x:unknown){return {swingCapitalQuote:10000,entryPrice:100,stopPrice:90,maxRiskPerTradePct:P0_ENTRY_POLICY.maxRiskPerTradePct,feePct:P0_ENTRY_POLICY.roundTripFeePct,slippagePct:P0_ENTRY_POLICY.slippagePct,openSwingPositions:0,maxPositions:P0_ENTRY_POLICY.maxPositions,monthlyLossQuote:0,maxMonthlyLossPct:P0_ENTRY_POLICY.maxMonthlyLossPct,atr:5,atrStopMultiple:P0_ENTRY_POLICY.atrStopMultiple};}
assert.equal(atrBlocked.allowed,false); assert.match(atrBlocked.reason??"","ATR");
const paused=calculateSpotSwingRisk(riskInput(risk)); assert.equal(paused.allowed,true);
const pause=calculateSpotSwingRisk({...riskInput(risk),monthlyLossQuote:200}); assert.equal(pause.allowed,false); assert.equal(pause.pauseMonthlyLoss,true);
assert.equal(assessBtcFilter({btc24hChangePct:null,supportBroken:null}).passed,false);
assert.equal(assessBtcFilter({btc24hChangePct:-.06,supportBroken:false}).passed,false);
assert.equal(assessBtcFilter({btc24hChangePct:0,supportBroken:false}).passed,true);
const analysis=analyzePastEntries([{date:"2026-01-01",entryPrice:1,minimumPriceAfterEntry:.9,forwardPrices:[{days:1,price:1.02},{days:3,price:.98},{days:7,price:1.1}]}]);
assert.equal(analysis.observations,1); assert.equal(analysis.label,"statistique historique, pas une prévision"); assert.match(analysis.warning,/Faible/);
console.log("p0 swing spot: PASS");
