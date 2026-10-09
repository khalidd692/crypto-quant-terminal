import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { appendFollowUp, appendProspectiveRecord, readProspectiveJournal } from "./journal.js";
import { emitAlerts } from "./alerts.js";
import { loadSurveillanceConfig, type SurveillanceAssetConfig } from "./config.js";
import { evaluateTelSurveillance, type VenueSnapshot } from "../surveillance/tel-usdt.js";
import { fetchContextSnapshot } from "../context/providers/index.js";
import { runTelEntryPipeline } from "../surveillance/tel-entry-pipeline.js";
import type { MarketDataPoint } from "../domain/types.js";

const JOURNAL=process.env.PROSPECTIVE_JOURNAL??"research/prospective/journal.jsonl";
const OUTPUT=process.env.TEL_DECISION_HTML??"artifacts/tel-decision.html";
const MAX_CONTEXT_AGE_MS=24*60*60_000;
function num(value:unknown):number{const n=Number(value);if(!Number.isFinite(n))throw new Error("Invalid numeric market value");return n;}
async function json(url:string):Promise<any>{const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{accept:"application/json"}});if(!response.ok)throw new Error(`HTTP ${response.status} for ${url}`);return response.json();}
function sha(value:unknown):string{return "sha256:"+createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function asIso(secondsOrMs:unknown,fallback:string):string{const n=Number(secondsOrMs);if(!Number.isFinite(n)||n<=0)return fallback;const ms=n<1e12?n*1000:n;return new Date(ms).toISOString();}
interface LiveInputs { primary:VenueSnapshot; control:VenueSnapshot; candles:MarketDataPoint[]; btc24hChangePct:number|null; btcSupportBroken:boolean|null; liquidity:{spreadBps:number;depthQuote:number;estimatedSlippageBps:number;observedAt:string;sourceHash:string}|null; venueStatus:"OK"|"UNAVAILABLE"|"PÉRIMÉ"|"INCOHÉRENT"; venueDetail:string; }
function bookSideDepth(levels:unknown):number{if(!Array.isArray(levels))return 0;return levels.reduce((sum,row)=>{if(!Array.isArray(row))return sum;const p=Number(row[0]),q=Number(row[1]);return Number.isFinite(p)&&Number.isFinite(q)&&p>0&&q>0?sum+p*q:sum;},0);}
function estimateBuyImpactBps(asks:unknown,notional:number,bestAsk:number):number{
 if(!Array.isArray(asks)||notional<=0||bestAsk<=0)return 1_000_000;
 let remaining=notional,base=0,quote=0;
 for(const row of asks){if(!Array.isArray(row))continue;const p=Number(row[0]),q=Number(row[1]);if(!Number.isFinite(p)||!Number.isFinite(q)||p<=0||q<=0)continue;const take=Math.min(remaining,p*q);base+=take/p;quote+=take;remaining-=take;if(remaining<=1e-8)break;}
 if(remaining>Math.max(1e-8,notional*1e-6)||base<=0)return 1_000_000;
 return Math.max(0,(quote/base/bestAsk-1)*10_000);
}
async function collect(asset:SurveillanceAssetConfig,now:string):Promise<LiveInputs>{
 const end=Math.floor(Date.now()/1000),start=end-220*3600;
 const urls=[
  "https://api.kucoin.com/api/ua/v1/market/ticker?tradeType=SPOT&symbol="+encodeURIComponent(asset.primarySymbol),
  "https://api.mexc.com/api/v3/ticker/bookTicker?symbol="+encodeURIComponent(asset.controlSymbol),
  "https://api.mexc.com/api/v3/ticker/24hr?symbol="+encodeURIComponent(asset.controlSymbol),
  "https://api.kucoin.com/api/v1/market/candles?symbol="+encodeURIComponent(asset.primarySymbol)+"&type=1hour&startAt="+start+"&endAt="+end,
  "https://api.kucoin.com/api/v3/market/orderbook/level2_20?symbol="+encodeURIComponent(asset.primarySymbol),
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=30"
 ];
 const [k,mPrice,m24,kline,book,btc]=await Promise.all(urls.map(json));
 const kd=k?.data?.list?.[0];if(!kd)throw new Error("KuCoin ticker unavailable");
 const kuLast=num(kd.lastPrice),kuBid=num(kd.bestBidPrice),kuAsk=num(kd.bestAskPrice);
 const mxLast=num(m24.lastPrice),mxBid=num(mPrice.bidPrice),mxAsk=num(mPrice.askPrice);
 const candleRows=Array.isArray(kline?.data)?kline.data:[];
 const candles:MarketDataPoint[]=candleRows.map((row:any)=>({instrumentId:asset.id,eventTime:asIso(row[0],now) as MarketDataPoint["eventTime"],availableTime:now as MarketDataPoint["availableTime"],open:num(row[1]),close:num(row[2]),high:num(row[3]),low:num(row[4]),volume:num(row[5]),dataQuality:"complete",sourceId:"KUCOIN_SPOT_KLINES_1H"})).sort((a,b)=>Date.parse(a.eventTime)-Date.parse(b.eventTime));
 const lastCandle=candles.at(-1),candleAge=lastCandle?Date.parse(now)-Date.parse(lastCandle.eventTime):Infinity;
 const quality=candleAge>90*60_000?"STALE":"OK";
 const primary:VenueSnapshot={venue:"KUCOIN",symbol:asset.primarySymbol,eventTime:lastCandle?.eventTime??now,availableTime:now,lastPrice:kuLast,bid:kuBid,ask:kuAsk,volume24hQuote:num(kd.quoteVolume),trendOk:num(kd.priceChangePercent)>=0,volatilityOk:((num(kd.high)-num(kd.low))/kuLast*100)<=asset.max24hRangePct,quality};
 const control:VenueSnapshot={venue:"MEXC",symbol:asset.controlSymbol,eventTime:asIso(m24.closeTime,now),availableTime:now,lastPrice:mxLast,bid:mxBid,ask:mxAsk,volume24hQuote:num(m24.quoteVolume??m24.volume),trendOk:num(m24.priceChangePercent)>=0,volatilityOk:((num(m24.highPrice)-num(m24.lowPrice))/mxLast*100)<=asset.max24hRangePct,quality:Date.now()-Date.parse(asIso(m24.closeTime,now))>asset.maxAgeMs?"STALE":"OK"};
 const venueEval=evaluateTelSurveillance(primary,control,{maxAgeMs:asset.maxAgeMs,maxCrossVenueDeviationBps:asset.maxCrossVenueDeviationBps,entryZone:asset.entryZone,invalidationPrice:asset.invalidationPrice,target1:asset.target1,target2:asset.target2,maxLossQuote:asset.maxLossQuote,existingPosition:"NONE",exitTriggered:false},Date.parse(now));
 let venueStatus:LiveInputs["venueStatus"]=venueEval.degraded?"INCOHÉRENT":"OK",venueDetail=venueEval.reasons.join("; ");
 if(candleAge>90*60_000){venueStatus="PÉRIMÉ";venueDetail="Dernière bougie KuCoin trop ancienne";}
 const bids=book?.data?.bids??book?.bids,asks=book?.data?.asks??book?.asks;
 const bidDepth=bookSideDepth(bids),askDepth=bookSideDepth(asks),depthQuote=Math.min(bidDepth,askDepth);
 const spreadBps=kuLast>0?((kuAsk-kuBid)/kuLast)*10_000:Infinity;
 const swingCapital=num(process.env.SWING_CAPITAL_QUOTE??1000),maxRiskQuote=swingCapital*.005;
 const stop=asset.invalidationPrice,estimatedNotional=kuLast>stop?maxRiskQuote/(kuLast-stop)*kuLast: swingCapital;
 const estimatedSlippageBps=estimateBuyImpactBps(asks,estimatedNotional,kuAsk);
 const liquidity=Number.isFinite(spreadBps)&&Number.isFinite(depthQuote)&&depthQuote>0?{spreadBps,depthQuote,estimatedSlippageBps,observedAt:now,sourceHash:sha(book)}:null;
 const btcRows=Array.isArray(btc)?btc:[];
 let btc24hChangePct:number|null=null,btcSupportBroken:boolean|null=null;
 if(btcRows.length>=25){const old=Number(btcRows[btcRows.length-25]?.[4]),latest=Number(btcRows.at(-1)?.[4]);const priorLows=btcRows.slice(-25,-1).map((x:any)=>Number(x[3])).filter(Number.isFinite);if(old>0&&latest>0&&priorLows.length===24){btc24hChangePct=latest/old-1;btcSupportBroken=latest<Math.min(...priorLows);}}
 return{primary,control,candles,btc24hChangePct,btcSupportBroken,liquidity,venueStatus,venueDetail};
}
function appendDueFollowUps(path:string,records:ReturnType<typeof readProspectiveJournal>,now:string,prices:Readonly<Record<string,number>>):void{for(const origin of records.filter(r=>r.mode==="TEST_SANS_ARGENT"&&r.referenceRecordHash===undefined&&r.priceQuote!==undefined)){for(const horizon of [1,3,7] as const){if(Date.parse(now)<Date.parse(origin.recordedAt)+horizon*86400000)continue;if(records.some(r=>r.referenceRecordHash===origin.recordHash&&r.horizonDays===horizon))continue;const price=prices[origin.assetId];if(price===undefined||!Number.isFinite(price)||price<=0)continue;appendFollowUp(path,origin,horizon,price,now);}}}
async function main():Promise<void>{
 const config=loadSurveillanceConfig(process.env.SURVEILLANCE_CONFIG??"config/surveillance-assets.json");
 mkdirSync(JOURNAL.split("/").slice(0,-1).join("/")||".",{recursive:true});mkdirSync(OUTPUT.split("/").slice(0,-1).join("/")||".",{recursive:true});
 const now=new Date().toISOString(),journalBeforeRun=readProspectiveJournal(JOURNAL),prices:Record<string,number>={};
 for(const asset of config.assets){
  let decision:"ENTRER"|"ATTENDRE"|"NE_PAS_ENTRER"="ATTENDRE",reasons:string[]=["Données indisponibles: ATTENDRE"],snapshotHash="sha256:unavailable",priceQuote:number|undefined,contextSnapshot:null|Awaited<ReturnType<typeof fetchContextSnapshot>>=null;
  let html="<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>Puis-je acheter maintenant ?</title><body><h1>ATTENDRE</h1><p>Collecte indisponible. EN TEST — SANS ARGENT. Aucun ordre.</p></body></html>";
  try{
   const [live,contextResult]=await Promise.allSettled([collect(asset,now),fetchContextSnapshot("entry-pipeline:"+now,asset.id,now)]);
   if(contextResult.status==="fulfilled")contextSnapshot=contextResult.value;
   if(live.status!=="fulfilled")throw new Error("COLLECTE_UNAVAILABLE: "+String(live.reason));
   const market=live.value;
   priceQuote=market.primary.lastPrice;prices[asset.id]=priceQuote;
   const qualityBars=market.candles;
   const price24hAgo=qualityBars.length>=25?qualityBars[qualityBars.length-25]?.close??null:null;
   const price7dAgo=qualityBars.length>=169?qualityBars[qualityBars.length-169]?.close??null:null;
   const contextProvenance=contextSnapshot?.provenance??[];
   const contextUnavailable=contextProvenance.filter(p=>p.status==="UNAVAILABLE");
   const contextError=contextSnapshot?undefined:"Context providers unavailable";
   const output=runTelEntryPipeline({now,candles:qualityBars,price24hAgo,price7dAgo,btc24hChangePct:market.btc24hChangePct,btcSupportBroken:market.btcSupportBroken,context:contextSnapshot,contextError,venueStatus:market.venueStatus,venueDetail:market.venueDetail,telLiquidity:market.liquidity,swingCapitalQuote:num(process.env.SWING_CAPITAL_QUOTE??1000),stopPrice:asset.invalidationPrice,openSwingPositions:num(process.env.OPEN_SWING_POSITIONS??0),monthlyLossQuote:num(process.env.MONTHLY_LOSS_QUOTE??0)});
   decision=output.decision;reasons=[output.reason,...output.angles.map(a=>`ANGLE[${a.angle}]=${a.status} | ${a.detail} | source=${a.source} | at=${a.observedAt??"UNAVAILABLE"} | hash=${a.sourceHash??"UNAVAILABLE"}`),...contextUnavailable.map(p=>`PROVENANCE_UNAVAILABLE[${p.field}]=${p.reason??"unavailable"}`)];
   html=output.html;
   snapshotHash=sha({pipelineHash:output.snapshotHash,market:{candles:qualityBars,primary:market.primary,control:market.control,btc24hChangePct:market.btc24hChangePct,btcSupportBroken:market.btcSupportBroken,liquidity:market.liquidity},contextHash:contextSnapshot?.snapshotHash??null,angles:output.angles});
   console.log(JSON.stringify({assetId:asset.id,asOf:now,decision,reason:output.reason,priceQuote,snapshotHash,contextHash:contextSnapshot?.snapshotHash??null,provenance:contextSnapshot?.provenance.map(p=>({field:p.field,source:p.source,availableAt:p.availableAt,sourceSnapshotHash:p.sourceSnapshotHash,status:p.status})),angles:output.angles.map(a=>({angle:a.angle,status:a.status,detail:a.detail,source:a.source,observedAt:a.observedAt,sourceHash:a.sourceHash})),mode:"TEST_SANS_ARGENT",ordersSent:false},null,2));
  }catch(error){decision="ATTENDRE";reasons=["API_UNAVAILABLE_OR_TIMEOUT",String(error).slice(0,240),"Fail-closed: aucun ordre n'est exécuté."];snapshotHash=sha({at:now,assetId:asset.id,error:String(error)});}
  writeFileSync(OUTPUT,html+"\n",{encoding:"utf8"});
  const previous=[...journalBeforeRun].reverse().find(item=>item.assetId===asset.id&&item.decision!=="ALERTE")?.decision??null;
  const record=appendProspectiveRecord(JOURNAL,{schemaVersion:"prospective-journal.v1",recordedAt:now,assetId:asset.id,decision,reasons,snapshotHash,mode:"TEST_SANS_ARGENT",...(priceQuote===undefined?{}:{priceQuote})});
  try{await emitAlerts(JOURNAL,asset.id,decision,previous,snapshotHash,contextSnapshot,now);}catch(error){appendProspectiveRecord(JOURNAL,{schemaVersion:"prospective-journal.v1",recordedAt:now,assetId:"__ALERT__",decision:"ALERTE",reasons:["ALERT_CONTEXT_UNAVAILABLE",String(error).slice(0,160)],snapshotHash});}
  console.log(`::warning title=TEL ${asset.id} — Puis-je acheter maintenant ?::${decision} — ${reasons[0]} — record ${record.recordHash}`);
 }
 appendDueFollowUps(JOURNAL,journalBeforeRun,now,prices);
 console.log("TEL decision screen written: "+OUTPUT+"; mode TEST_SANS_ARGENT; ordersSent=false");
}
await main();
