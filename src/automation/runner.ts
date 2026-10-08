import { readFileSync, mkdirSync } from "node:fs";
import { appendProspectiveRecord, readProspectiveJournal } from "./journal.js";
import { emitAlerts } from "./alerts.js";
import { loadSurveillanceConfig, type SurveillanceAssetConfig } from "./config.js";
import { evaluateTelSurveillance, type VenueSnapshot } from "../surveillance/tel-usdt.js";
import { createContextSnapshot } from "../context/snapshot.js";
import { fetchContextSnapshot } from "../context/providers/index.js";
const JOURNAL=process.env.PROSPECTIVE_JOURNAL??"research/prospective/journal.jsonl";
function num(value:unknown):number { const n=Number(value); if(!Number.isFinite(n)) throw new Error("Invalid numeric market value"); return n; }
async function json(url:string):Promise<any>{ const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{accept:"application/json"}}); if(!response.ok) throw new Error(`HTTP ${response.status} for ${url}`); return response.json(); }
async function snapshot(asset:SurveillanceAssetConfig,now:string):Promise<{primary:VenueSnapshot;control:VenueSnapshot}> {
  const [k,mPrice,m24]=await Promise.all([
    json("https://api.kucoin.com/api/ua/v1/market/ticker?tradeType=SPOT&symbol="+encodeURIComponent(asset.primarySymbol)),
    json("https://api.mexc.com/api/v3/ticker/bookTicker?symbol="+encodeURIComponent(asset.controlSymbol)),
    json("https://api.mexc.com/api/v3/ticker/24hr?symbol="+encodeURIComponent(asset.controlSymbol))
  ]);
  const kd=k?.data?.list?.[0]; if(!kd) throw new Error("KuCoin ticker unavailable");
  const kuLast=num(kd.lastPrice), kuHigh=num(kd.high), kuLow=num(kd.low), kuChange=num(kd.priceChangePercent)*100;
  const md24=m24; const mxLast=num(md24.lastPrice); const mxHigh=num(md24.highPrice), mxLow=num(md24.lowPrice);
  const primary:VenueSnapshot={venue:"KUCOIN",symbol:asset.primarySymbol,eventTime:now,availableTime:now,lastPrice:kuLast,bid:num(kd.bestBidPrice),ask:num(kd.bestAskPrice),volume24hQuote:num(kd.quoteVolume),trendOk:kuChange>=0,volatilityOk:((kuHigh-kuLow)/kuLast*100)<=asset.max24hRangePct,quality:"OK"};
  const control:VenueSnapshot={venue:"MEXC",symbol:asset.controlSymbol,eventTime:now,availableTime:now,lastPrice:mxLast,bid:num(mPrice.bidPrice),ask:num(mPrice.askPrice),volume24hQuote:num(md24.quoteVolume??md24.volume),trendOk:num(md24.priceChangePercent)>=0,volatilityOk:((mxHigh-mxLow)/mxLast*100)<=asset.max24hRangePct,quality:"OK"};
  return {primary,control};
}
async function main():Promise<void>{
  const config=loadSurveillanceConfig(process.env.SURVEILLANCE_CONFIG??"config/surveillance-assets.json");
  mkdirSync(JOURNAL.split("/").slice(0,-1).join("/")||".",{recursive:true});
  const now=new Date().toISOString();
  const journalBeforeRun = readProspectiveJournal(JOURNAL);
  for(const asset of config.assets){
    let decision="NE_PAS_ENTRER", reasons:string[]=["Données indisponibles"], snapshotHash="sha256:unavailable";
    try{
      const venues=await snapshot(asset,now);
      const context=createContextSnapshot({schemaVersion:"context-snapshot.v1",instrumentId:asset.id,asOf:now,market:{totalMarketCapQuote:null,btcDominancePct:null,btcReturnPct:null,realizedVolPct:null,breadthPct:null},macro:{ratesBias:"UNKNOWN",inflationBias:"UNKNOWN",dollarBias:"UNKNOWN",sourceAsOf:null},events:{events:[]},liquidity:{venue:"KUCOIN",symbol:asset.primarySymbol,spreadBps:((venues.primary.ask-venues.primary.bid)/venues.primary.lastPrice)*10000,depthQuote:Math.min(venues.primary.bid,venues.primary.ask)*Math.min(1,1),volume24hQuote:venues.primary.volume24hQuote,observedAt:now},fundamentals:{protocolActivity:"UNKNOWN",developmentActivity:"UNKNOWN",valuationAssessment:"UNKNOWN",sourceAsOf:null},macroRegime:{regime:"UNKNOWN",rationale:"No macro feed configured in this surveillance run.",methodologyVersion:"descriptive-regime.v1"}});
      const output=evaluateTelSurveillance(venues.primary,venues.control,{maxAgeMs:asset.maxAgeMs,maxCrossVenueDeviationBps:asset.maxCrossVenueDeviationBps,entryZone:asset.entryZone,invalidationPrice:asset.invalidationPrice,target1:asset.target1,target2:asset.target2,maxLossQuote:asset.maxLossQuote,existingPosition:"NONE",exitTriggered:false},Date.parse(now));
      decision=output.decision; reasons=[...output.reasons]; snapshotHash=context.snapshotHash;
    }catch(error){ reasons=["API_UNAVAILABLE_OR_TIMEOUT"]; }
    const previous = [...journalBeforeRun].reverse().find(item => item.assetId === asset.id && item.decision !== "ALERTE")?.decision ?? null;
    const record=appendProspectiveRecord(JOURNAL,{schemaVersion:"prospective-journal.v1",recordedAt:now,assetId:asset.id,decision,reasons,snapshotHash});
    try {
      const context = await fetchContextSnapshot("surveillance:"+now, asset.id, now);
      await emitAlerts(JOURNAL, asset.id, decision as any, previous, snapshotHash, context, now);
    } catch (error) {
      appendProspectiveRecord(JOURNAL,{schemaVersion:"prospective-journal.v1",recordedAt:now,assetId:"__ALERT__",decision:"ALERTE",reasons:["ALERT_CONTEXT_UNAVAILABLE",String(error).slice(0,160)],snapshotHash});
    }
    if(["ENTRER","SORTIR"].includes(decision)||decision==="NE_PAS_ENTRER") console.log(`::warning title=Surveillance ${asset.id}::${decision} — ${reasons.join(" | ")} — record ${record.recordHash}`);
  }
}
await main();
