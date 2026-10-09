import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContextSnapshot } from "../src/context/snapshot.js";
import type { ContextSnapshot, ContextProvenance } from "../src/context/types.js";
import type { MarketDataPoint } from "../src/domain/types.js";
import { runTelEntryPipeline } from "../src/surveillance/tel-entry-pipeline.js";

const now="2026-10-09T12:00:00.000Z";
const hash=("sha256:"+"a".repeat(64)) as `sha256:${string}`;
function point(i:number,close=1,availableAt?:string):MarketDataPoint{
  const t=Date.parse(now)-(199-i)*3600_000;
  return {instrumentId:"TEL-USDT",eventTime:new Date(t).toISOString() as MarketDataPoint["eventTime"],availableTime:(availableAt??new Date(t+5_000).toISOString()) as MarketDataPoint["availableTime"],open:close,high:close+.005,low:close-.005,close,volume:100,dataQuality:"complete",sourceId:"KUCOIN_SPOT"};
}
function prov(field:string):ContextProvenance{return{field,source:"fixture://provider",availableAt:now,sourceSnapshotHash:hash,status:"OK"};}
function context(eventAt?:string):ContextSnapshot{
 const provenance=[prov("macro.DFF"),prov("macro.DGS10"),prov("macro.DTWEXBGS"),prov("macro.CPIAUCSL"),prov("events.fomc"),prov("market.sentimentScore"),prov("social.reddit"),prov("fundamentalsTel.coingecko"),prov("fundamentalsTel.newsroom")];
 return createContextSnapshot({schemaVersion:"context-snapshot.v1",instrumentId:"TEL-USDT",asOf:now,
 market:{totalMarketCapQuote:1e12,btcDominancePct:55,btcReturnPct:0.01,realizedVolPct:2,breadthPct:50,sentimentScore:50},
 macro:{ratesBias:"NEUTRAL",inflationBias:"NEUTRAL",dollarBias:"NEUTRAL",policyRatePct:4,tenYearYieldPct:4,dollarIndex:100,cpiYoYPct:2.5,sourceAsOf:now},
 events:{events:eventAt?[{id:"fomc-near",timestamp:eventAt,category:"MACRO",label:"FOMC proche",importance:"HIGH"}]:[]},
 liquidity:{venue:"KUCOIN",symbol:"TEL-USDT",spreadBps:5,depthQuote:10000,volume24hQuote:100000,observedAt:now},
 fundamentals:{protocolActivity:"STABLE",developmentActivity:"STABLE",valuationAssessment:"FAIR",sourceAsOf:now},
 macroRegime:{regime:"NEUTRAL",rationale:"Fixture descriptive",methodologyVersion:"descriptive-regime.v1"},
 provenance,fundamentalsTel:{circulatingSupply:100,totalSupply:1000,marketCapQuote:1e8,newsCount:1,latestNews:[],tokenUnlocks:"OK",networkActivity:"OK",notableFlows:"OK",sourceAsOf:now},
 socialSentiment:{mentions:10,mentionChangePct:0,toneScore:0,concentrationTop5Pct:.2,attentionSpike:false,temperature:"NEUTRAL",label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:now}});
}
function input(overrides:Partial<Parameters<typeof runTelEntryPipeline>[0]>={}):Parameters<typeof runTelEntryPipeline>[0]{
 const candles=Array.from({length:200},(_,i)=>point(i));
 return {now,dataMode:"SIMULÉ",candles,price24hAgo:1,price7dAgo:1,btc24hChangePct:0.01,btcSupportBroken:false,context:context(),venueStatus:"OK",venueDetail:"KuCoin/MEXC cohérents",telLiquidity:{spreadBps:5,depthQuote:10000,estimatedSlippageBps:5,observedAt:now,sourceHash:hash},swingCapitalQuote:1000,stopPrice:.97,openSwingPositions:0,monthlyLossQuote:0,...overrides};
}
const missing=runTelEntryPipeline(input({candles:[],price24hAgo:null,price7dAgo:null}));
assert.equal(missing.decision,"ATTENDRE");assert.ok(missing.angles.some(a=>a.status==="UNAVAILABLE"));
const staleCandles=Array.from({length:200},(_,i)=>point(i,1,"2026-10-09T09:00:00.000Z"));
const stale=runTelEntryPipeline(input({candles:staleCandles}));
assert.equal(stale.decision,"ATTENDRE");assert.ok(stale.angles.some(a=>a.angle==="Historique / fraîcheur"&&a.status==="PÉRIMÉ"));
const stretchedCandles=Array.from({length:200},(_,i)=>point(i,i===199?1.2:1));
const stretched=runTelEntryPipeline(input({candles:stretchedCandles}));
assert.equal(stretched.quality.decision,"EXTENDED");assert.equal(stretched.decision,"ATTENDRE");
const btcDrop=runTelEntryPipeline(input({btc24hChangePct:-.06}));
assert.equal(btcDrop.decision,"ATTENDRE");assert.ok(btcDrop.angles.some(a=>a.angle==="Filtre BTC"&&a.status==="BLOC"));
const macroNear=runTelEntryPipeline(input({context:context("2026-10-10T12:00:00.000Z")}));
assert.equal(macroNear.decision,"ATTENDRE");assert.ok(macroNear.angles.some(a=>a.angle==="Macro + calendrier"&&a.status==="BLOC"));
const unavailableAngle=runTelEntryPipeline(input({venueStatus:"UNAVAILABLE",venueDetail:"MEXC indisponible"}));
assert.notEqual(unavailableAngle.decision,"ENTRER");
const healthy=runTelEntryPipeline(input());
assert.ok(healthy.html.includes("Puis-je acheter maintenant ?"));
assert.ok(healthy.html.includes("EN TEST — SANS ARGENT"));
assert.ok(healthy.angles.every(a=>a.mode==="SIMULÉ"||a.mode==="UNAVAILABLE"));
assert.ok(["ATTENDRE","ENTRER","NE_PAS_ENTRER"].includes(healthy.decision));
const runnerSource=readFileSync("src/automation/runner.ts","utf8");
const pipelineSource=readFileSync("src/surveillance/tel-entry-pipeline.ts","utf8");
assert.match(runnerSource,/runTelEntryPipeline\(/,"runner must call the integrated pipeline");
assert.match(pipelineSource,/assessEntryQuality\(/,"pipeline must call P0 assessEntryQuality");
assert.match(pipelineSource,/renderTelTestScreen\(/,"pipeline must call renderTelTestScreen");
console.log("TEL entry pipeline integration: PASS (missing, stale, stretched, BTC drop, macro event, no-force-enter, rendered screen)");
