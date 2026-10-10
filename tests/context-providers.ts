import{strict as assert}from"node:assert";import{createContextSnapshot,assertContextSnapshotHash}from"../src/context/snapshot.js";import{fetchContextSnapshot}from"../src/context/providers/index.js";
const fixture=createContextSnapshot({schemaVersion:"context-snapshot.v1",runId:"fixture-run-001",instrumentId:"BTCUSDT",asOf:"2026-10-08T00:00:00.000Z",market:{totalMarketCapQuote:100,btcDominancePct:50,btcReturnPct:1,realizedVolPct:null,breadthPct:null,fundingRatePct:.0001,openInterestQuote:1000,sentimentScore:60},macro:{ratesBias:"NEUTRAL",inflationBias:"NEUTRAL",dollarBias:"NEUTRAL",policyRatePct:4,tenYearYieldPct:4,dollarIndex:120,cpiYoYPct:3,sourceAsOf:"2026-10-08T00:00:00.000Z"},events:{events:[]},liquidity:{venue:"FIXTURE",symbol:"BTCUSDT",spreadBps:1,depthQuote:null,volume24hQuote:1000,stablecoinMarketCapQuote:200,stablecoinSourceAsOf:"2026-10-08T00:00:00.000Z",observedAt:"2026-10-08T00:00:00.000Z"},fundamentals:{protocolActivity:"UNKNOWN",developmentActivity:"UNKNOWN",valuationAssessment:"UNKNOWN",sourceAsOf:null},macroRegime:{regime:"NEUTRAL",rationale:"fixture",methodologyVersion:"descriptive-regime.v1"},provenance:[{field:"fixture",source:"fixture://context",availableAt:"2026-10-08T00:00:00.000Z",sourceSnapshotHash:"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",status:"OK"}]});assertContextSnapshotHash(fixture);assert.throws(()=>assertContextSnapshotHash({...fixture,market:{...fixture.market,btcDominancePct:51}}),/hash mismatch/);
const old=globalThis.fetch;globalThis.fetch=async()=>{throw new TypeError("fixture network unavailable")};const u=await fetchContextSnapshot("fixture-unavailable");assert.equal(u.market.totalMarketCapQuote,null);assert.equal(u.market.fundingRatePct,null);assert.equal(u.market.sentimentScore,null);assert.equal(u.macro.ratesBias,"UNKNOWN");assert.ok(u.provenance.some(x=>x.status==="UNAVAILABLE"));assertContextSnapshotHash(u);globalThis.fetch=old;
import { calculateSpreadBps } from "../src/context/providers/liquidity.js";

assert.equal(calculateSpreadBps(100, 101), (1 / 100.5) * 10000);
assert.equal(calculateSpreadBps(100, 100), 0);
assert.equal(calculateSpreadBps(null, 101), null);
assert.equal(calculateSpreadBps(0, 101), null);
assert.equal(calculateSpreadBps(101, 100), null);
assert.equal(calculateSpreadBps(Number.NaN, 101), null);

console.log("context providers: PASS");