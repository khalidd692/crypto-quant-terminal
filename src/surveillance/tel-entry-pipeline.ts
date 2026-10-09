import type { MarketDataPoint } from "../domain/types.js";
import type { ContextSnapshot } from "../context/types.js";
import { assessBtcFilter, assessEntryQuality, calculateSpotSwingRisk, P0_ENTRY_POLICY, type EntryQuality, type SpotRiskResult, type SwingDecision } from "./tel-swing.js";
import { assessLiquidity } from "../risk/liquidity.js";

export type AngleStatus = "OK" | "BLOC" | "UNAVAILABLE" | "PÉRIMÉ" | "INCOHÉRENT";
export interface EntryAngle { readonly angle: string; readonly mode: "RÉEL" | "UNAVAILABLE" | "SIMULÉ"; readonly status: AngleStatus; readonly detail: string; readonly source: string; readonly observedAt: string | null; readonly sourceHash: string | null; }
export interface EntryPipelineInput {
  readonly now: string;
  readonly dataMode?: "RÉEL" | "SIMULÉ";
  readonly candles: readonly MarketDataPoint[];
  readonly price24hAgo: number | null;
  readonly price7dAgo: number | null;
  readonly relativeVolume?: number | null;
  readonly btc24hChangePct: number | null;
  readonly btcSupportBroken: boolean | null;
  readonly btcUnavailableReason?: string;
  readonly context: ContextSnapshot | null;
  readonly contextError?: string;
  readonly venueStatus: "OK" | "UNAVAILABLE" | "PÉRIMÉ" | "INCOHÉRENT";
  readonly marketSourceHash?: string;
  readonly candlesSourceHash?: string;
  readonly btcSourceHash?: string;
  readonly venueDetail: string;
  readonly telLiquidity: { readonly spreadBps: number; readonly depthQuote: number; readonly estimatedSlippageBps: number; readonly observedAt: string; readonly sourceHash: string } | null;
  readonly swingCapitalQuote: number;
  readonly stopPrice: number | null;
  readonly openSwingPositions: number;
  readonly monthlyLossQuote: number;
}
export interface EntryPipelineOutput {
  readonly decision: SwingDecision;
  readonly reason: string;
  readonly quality: EntryQuality;
  readonly risk: SpotRiskResult;
  readonly angles: readonly EntryAngle[];
  readonly html: string;
  readonly snapshotHash: string;
  readonly priceQuote: number | null;
}
const disabledRisk: SpotRiskResult = { allowed:false,riskBudgetQuote:0,riskPerUnitQuote:0,frictionPerUnitQuote:0,quantity:0,notionalQuote:0,maxLossQuote:0,pauseMonthlyLoss:false,tranches:[],reason:"Dimensionnement indisponible",methodologyVersion:"p0-spot-risk.v1" };
function angle(angle:string,status:AngleStatus,detail:string,source:string,observedAt:string|null=null,sourceHash:string|null=null):EntryAngle{return{angle,mode:status==="UNAVAILABLE"?"UNAVAILABLE":"RÉEL",status,detail,source,observedAt,sourceHash};}
function isFresh(when:string|null|undefined,now:string,maxAgeMs=120_000):boolean{if(!when)return false;const t=Date.parse(when),n=Date.parse(now);return Number.isFinite(t)&&Number.isFinite(n)&&t<=n+5_000&&n-t<=maxAgeMs;}
function hashOf(context:ContextSnapshot|null):string{return context?.snapshotHash??"sha256:unavailable";}
export function runTelEntryPipeline(input:EntryPipelineInput):EntryPipelineOutput {
  const nowMs=Date.parse(input.now), last=input.candles.at(-1), price=last?.close??null;
  const quality=assessEntryQuality({points:input.candles,...(input.price24hAgo===null?{}:{price24hAgo:input.price24hAgo}),...(input.price7dAgo===null?{}:{price7dAgo:input.price7dAgo}),...(input.relativeVolume==null?{}:{relativeVolume:input.relativeVolume}),now:input.now});
  const angles:EntryAngle[]=[];
  const addAngle=(...args:Parameters<typeof angle>):EntryAngle=>{const item=angle(...args);return{...item,mode:item.status==="UNAVAILABLE"?"UNAVAILABLE":input.dataMode??"RÉEL"};};
  let macroStatus:AngleStatus="UNAVAILABLE";
  let sentimentStatus:AngleStatus="UNAVAILABLE";
  angles.push(addAngle("KuCoin + contrôle MEXC",input.venueStatus,input.venueDetail,"KuCoin Spot / MEXC",last?.availableTime??null,input.marketSourceHash??null));
  const candlesFresh=last!==undefined&&isFresh(last.availableTime,input.now,90*60_000)&&last.dataQuality==="complete";
  angles.push(angle("Historique / fraîcheur",candlesFresh?"OK":last?"PÉRIMÉ":"UNAVAILABLE",candlesFresh?"Bougie horaire récente et complète":"Historique absent, incomplet ou périmé","KuCoin Spot klines",last?.availableTime??null,input.candlesSourceHash??null));
  angles.push(angle("P0 — qualité d'entrée",quality.decision==="ACCEPTABLE"?"OK":quality.decision==="EXTENDED"?"BLOC":"UNAVAILABLE",quality.reasons.join("; ")||quality.decision,"assessEntryQuality",last?.availableTime??null,input.candlesSourceHash??null));
  const btc=assessBtcFilter({btc24hChangePct:input.btc24hChangePct,supportBroken:input.btcSupportBroken});
  const btcStatus=input.btc24hChangePct===null||input.btcSupportBroken===null?"UNAVAILABLE":btc.passed?"OK":"BLOC";
  angles.push(angle("Filtre BTC",btcStatus,btcStatus==="UNAVAILABLE"?(input.btcUnavailableReason??btc.reason):btc.reason,"KuCoin Spot BTC-USDT 1h klines",input.context?.asOf??null,input.btcSourceHash??null));
  const context=input.context;
  if(!context){
    angles.push(angle("Macro + calendrier","UNAVAILABLE",input.contextError??"Contexte absent","context providers"));
    angles.push(angle("Sentiment","UNAVAILABLE","Contexte absent","context providers"));
    angles.push(angle("Offre / on-chain","UNAVAILABLE","Contexte absent","CoinGecko / flux on-chain"));
  }else{
    const macroProv=context.provenance.filter(p=>p.field.startsWith("macro."));
    const eventProv=context.provenance.find(p=>p.field==="events.fomc");
    const macroOk=context.macro.ratesBias!=="UNKNOWN"&&context.macro.inflationBias!=="UNKNOWN"&&context.macro.dollarBias!=="UNKNOWN"&&macroProv.length>0&&macroProv.every(p=>p.status==="OK"&&isFresh(p.availableAt,input.now,7*86400_000));
    const highEvent=context.events.events.find(e=>e.importance==="HIGH"&&Date.parse(e.timestamp)>=nowMs&&Date.parse(e.timestamp)-nowMs<=48*3600_000);
    const eventOk=!!eventProv&&eventProv.status==="OK"&&isFresh(eventProv.availableAt,input.now,24*3600_000);
    macroStatus=!macroOk||!eventOk?"UNAVAILABLE":highEvent?"BLOC":"OK";
    angles.push(angle("Macro + calendrier",macroStatus,highEvent?("Événement majeur proche : "+highEvent.label):macroStatus==="OK"?"Macro renseignée, aucun événement HIGH dans les 48 h":"Macro ou calendrier indisponible/périmé","FRED + calendrier FOMC",context.asOf,context.snapshotHash));
    const sentimentProv=context.provenance.filter(p=>p.field.startsWith("market.sentiment")||p.field.startsWith("social."));
    const sentimentOk=context.market.sentimentScore!==null&&context.socialSentiment?.temperature!==undefined&&context.socialSentiment.temperature!=="UNAVAILABLE"&&sentimentProv.length>0&&sentimentProv.every(p=>p.status==="OK"&&isFresh(p.availableAt,input.now,24*3600_000));
    const sentimentBlocked=context.socialSentiment?.temperature==="HOT"||((context.socialSentiment?.concentrationTop5Pct??0)>.8);
    sentimentStatus=!sentimentOk?"UNAVAILABLE":sentimentBlocked?"BLOC":"OK";
    angles.push(angle("Sentiment",sentimentStatus, sentimentBlocked?"Attention sociale chaude/concentrée":sentimentOk?"Sentiment renseigné":"Sentiment indisponible/périmé","Alternative.me + Reddit/X",context.asOf,context.snapshotHash));
    const supplyProv=context.provenance.filter(p=>p.field.startsWith("fundamentalsTel."));
    const supplyOk=!!context.fundamentalsTel&&context.fundamentalsTel.circulatingSupply!==null&&context.fundamentalsTel.totalSupply!==null&&context.fundamentalsTel.tokenUnlocks==="OK"&&context.fundamentalsTel.notableFlows==="OK"&&supplyProv.length>0&&supplyProv.every(p=>p.status==="OK"&&isFresh(p.availableAt,input.now,24*3600_000));
    const supplyDeteriorating=context.fundamentalsTel?.tokenUnlocks==="UNAVAILABLE"||context.fundamentalsTel?.notableFlows==="UNAVAILABLE";
    angles.push(angle("Offre / on-chain",!supplyOk?"UNAVAILABLE":supplyDeteriorating?"BLOC":"OK",supplyOk?"Offre, déblocages et flux documentés":"Déblocages/flux on-chain non disponibles : veto conservateur","CoinGecko + flux on-chain",context.asOf,context.snapshotHash));
  }
  if(context){
    const unavailable=context.provenance.filter(p=>p.status==="UNAVAILABLE");
    angles.push(angle("Provenance globale",unavailable.length?"UNAVAILABLE":"OK",unavailable.length?unavailable.map(p=>p.field).join(", "):"Toutes les sources de contexte déclarées sont disponibles","Context providers",context.asOf,context.snapshotHash));
  } else angles.push(angle("Provenance globale","UNAVAILABLE","Aucun snapshot de contexte vérifiable","Context providers"));
  const liquidity=input.telLiquidity;
  const atrValue=quality.metrics.atr??0;
  const effectiveStop=price!==null&&input.stopPrice===null&&atrValue>0?price-atrValue*P0_ENTRY_POLICY.atrStopMultiple-Number.EPSILON*Math.max(1,price)*8:input.stopPrice;
  const risk=price!==null&&effectiveStop!==null&&effectiveStop>0&&effectiveStop<price&&atrValue>0?calculateSpotSwingRisk({swingCapitalQuote:input.swingCapitalQuote,entryPrice:price,stopPrice:effectiveStop,maxRiskPerTradePct:P0_ENTRY_POLICY.maxRiskPerTradePct,feePct:P0_ENTRY_POLICY.roundTripFeePct,slippagePct:P0_ENTRY_POLICY.slippagePct,openSwingPositions:input.openSwingPositions,maxPositions:P0_ENTRY_POLICY.maxPositions,monthlyLossQuote:input.monthlyLossQuote,maxMonthlyLossPct:P0_ENTRY_POLICY.maxMonthlyLossPct,atr:quality.metrics.atr??0,atrStopMultiple:P0_ENTRY_POLICY.atrStopMultiple}):disabledRisk;
  if(liquidity&&price!==null&&risk.notionalQuote>0){
    const gate=assessLiquidity({spreadBps:liquidity.spreadBps,estimatedSlippageBps:liquidity.estimatedSlippageBps,depthQuote:liquidity.depthQuote,orderNotionalQuote:risk.notionalQuote,maxSpreadBps:20,maxSlippageBps:50,minDepthMultiple:3});
    angles.push(angle("Liquidité réelle TEL",gate.passed?"OK":"BLOC",gate.reason??"Spread, impact estimé et profondeur conformes","KuCoin Spot order book",liquidity.observedAt,liquidity.sourceHash));
  }else angles.push(angle("Liquidité réelle TEL", "UNAVAILABLE","Carnet TEL ou dimensionnement indisponible","KuCoin Spot order book",liquidity?.observedAt??null,liquidity?.sourceHash??null));
  const finalAngles:EntryAngle[]=angles.map(a=>({...a,mode:(a.status==="UNAVAILABLE"?"UNAVAILABLE":input.dataMode??"RÉEL") as EntryAngle["mode"]}));
  const requiredAngles=finalAngles.filter(a=>a.angle!=="P0 — qualité d'entrée");
  const failing=requiredAngles.find(a=>a.status!=="OK")??finalAngles.find(a=>a.angle==="P0 — qualité d'entrée"&&a.status!=="OK");
  let decision:SwingDecision="ATTENDRE",reason="Tous les contrôles obligatoires sont satisfaits; décision descriptive uniquement.";
  if(input.venueStatus!=="OK"||!candlesFresh||!context||!liquidity||failing){decision="ATTENDRE";reason=failing?failing.angle+": "+failing.detail:input.venueStatus!=="OK"?"Données de marché indisponibles, périmées ou incohérentes":!candlesFresh?"Historique de bougies indisponible/périmé":!context?"Contexte obligatoire indisponible":"Liquidité réelle TEL indisponible";}
  else if(quality.decision==="UNAVAILABLE"){decision="ATTENDRE";reason=quality.reasons[0]??"Qualité d'entrée indisponible";}
  else if(!btc.passed){decision="ATTENDRE";reason=btc.reason;}
  else if(quality.decision==="EXTENDED"){decision="ATTENDRE";reason=quality.reasons[0]??"Prix étiré";}
  else if(!risk.allowed){decision="NE_PAS_ENTRER";reason=risk.reason??"Dimensionnement SWING interdit";}
  else if(finalAngles.some(a=>a.status!=="OK")){decision="ATTENDRE";reason="Au moins un veto contexte/liquidité n'est pas levé";} else {decision="ENTRER";reason="Qualité P0, BTC, contexte, liquidité et risque SWING validés";}
  // Every mandatory angle is a veto. No angle can promote a blocked or unavailable result to ENTRER.
  const finalDecision:SwingDecision=finalAngles.every(a=>a.status==="OK")&&risk.allowed&&decision==="ENTRER"?"ENTRER":decision==="ENTRER"?"ATTENDRE":decision;
  const finalReason=reason;
  const qualityForScreen:EntryQuality=quality;
  const { renderTelTestScreen }=screenRenderer;
  const html=renderTelTestScreen({asOf:input.now,decision:finalDecision,quality:qualityForScreen,btcStatus:btcStatus==="OK"?"OK":btcStatus==="UNAVAILABLE"?"UNAVAILABLE":"BLOCKED",macroStatus:macroStatus==="OK"?"OK":"UNAVAILABLE",sentimentStatus:sentimentStatus==="OK"?"OK":"UNAVAILABLE",risk,riskMaxPct:P0_ENTRY_POLICY.maxRiskPerTradePct,reason:finalReason,angles:finalAngles});
  return{decision:finalDecision,reason:finalReason,quality,risk,angles:finalAngles,html,snapshotHash:hashOf(context),priceQuote:price};
}
import { renderTelTestScreen } from "./tel-test-mode.js";
const screenRenderer={renderTelTestScreen};
function sentimentStatusFrom(angles:readonly EntryAngle[]):"OK"|"UNAVAILABLE"{return angles.find(a=>a.angle==="Sentiment")?.status==="OK"?"OK":"UNAVAILABLE";}
