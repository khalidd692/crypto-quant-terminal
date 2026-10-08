import type { MarketDataPoint } from "../domain/types.js";
import { averageTrueRange, exponentialMovingAverage, rsi } from "../features/indicators.js";
import { rollingVwapDeviation } from "../features/monitor-indicators.js";

export type SwingPocket = "CORE_HOLD" | "SWING";
export type SwingDecision = "ENTRER" | "ATTENDRE" | "NE_PAS_ENTRER";
export interface SwingPolicy {
  readonly maxEmaDistancePct: number; readonly maxVwapDistancePct: number; readonly maxRsi: number;
  readonly maxRise24hPct: number; readonly maxRise7dPct: number; readonly maxRelativeVolume: number;
  readonly maxDistanceFromLowPct: number; readonly atrStopMultiple: number; readonly maxRiskPerTradePct: number;
  readonly maxPositions: number; readonly maxMonthlyLossPct: number; readonly roundTripFeePct: number;
  readonly slippagePct: number; readonly btcFastDrop24hPct: number;
}
export const P0_ENTRY_POLICY: SwingPolicy = Object.freeze({
  maxEmaDistancePct: .05, maxVwapDistancePct: .03, maxRsi: 70, maxRise24hPct: .08, maxRise7dPct: .15,
  maxRelativeVolume: 3, maxDistanceFromLowPct: .25, atrStopMultiple: 1.5, maxRiskPerTradePct: .005,
  maxPositions: 2, maxMonthlyLossPct: .02, roundTripFeePct: .003, slippagePct: .005, btcFastDrop24hPct: .05
});
export interface SwingQualityInput {
  readonly points: readonly MarketDataPoint[]; readonly price24hAgo?: number; readonly price7dAgo?: number;
  readonly relativeVolume?: number; readonly now?: string;
}
export interface EntryQuality {
  readonly decision: "ACCEPTABLE" | "EXTENDED" | "UNAVAILABLE";
  readonly reasons: readonly string[]; readonly acceptableMaxEntry: number|null;
  readonly metrics: Readonly<Record<string, number|null>>;
  readonly methodologyVersion: "p0-entry-quality.v1";
}
export interface BtcFilterInput { readonly btc24hChangePct: number|null; readonly supportBroken: boolean|null; }
export interface SpotRiskInput {
  readonly swingCapitalQuote:number; readonly entryPrice:number; readonly stopPrice:number;
  readonly maxRiskPerTradePct:number; readonly feePct:number; readonly slippagePct:number;
  readonly openSwingPositions:number; readonly maxPositions:number; readonly monthlyLossQuote:number; readonly maxMonthlyLossPct:number;
  readonly tranches?: readonly number[];
}
export interface SpotRiskResult {
  readonly allowed:boolean; readonly riskBudgetQuote:number; readonly riskPerUnitQuote:number;
  readonly frictionPerUnitQuote:number; readonly quantity:number; readonly notionalQuote:number;
  readonly maxLossQuote:number; readonly pauseMonthlyLoss:boolean; readonly reason:string|null;
  readonly tranches:readonly number[]; readonly methodologyVersion:"p0-spot-risk.v1";
}
export interface SwingDecisionInput { readonly quality:EntryQuality; readonly btc:BtcFilterInput; readonly dataAvailable:boolean; readonly spotRisk:SpotRiskResult; }
export interface SwingDecisionOutput { readonly decision:SwingDecision; readonly reason:string; readonly acceptableEntry:number|null; readonly pocket:"SWING"; }

function finitePositive(n:number|undefined|null):n is number{return n!==undefined&&n!==null&&Number.isFinite(n)&&n>0;}
export function assessEntryQuality(input:SwingQualityInput, policy= P0_ENTRY_POLICY):EntryQuality{
  const p=input.points.at(-1), closes=input.points.map(x=>x.close);
  if(!p||input.points.length<200||!closes.every(finitePositive)) return {decision:"UNAVAILABLE",reasons:["Historique insuffisant pour EMA200 / ATR / VWAP"],acceptableMaxEntry:null,metrics:{},methodologyVersion:"p0-entry-quality.v1"};
  const ema=exponentialMovingAverage(closes,200), vwapDev=rollingVwapDeviation(input.points,24);
  const vwap=vwapDev===null?null:p.close/(1+vwapDev);
  const r=rsi(closes,14), atr=averageTrueRange(input.points,14), rise24=input.price24hAgo&&input.price24hAgo>0?p.close/input.price24hAgo-1:null;
  const rise7=input.price7dAgo&&input.price7dAgo>0?p.close/input.price7dAgo-1:null;
  const medianVolume=(()=>{const a=input.points.slice(-20).map(x=>x.volume).sort((a,b)=>a-b);return a.length? (a.length%2?a[9]??null:((a[9]??0)+(a[10]??0))/2):null;})();
  const relVol=input.relativeVolume??(medianVolume&&medianVolume>0?p.volume/medianVolume:null);
  const low=Math.min(...input.points.slice(-168).map(x=>x.low)), distLow=p.close>0?(p.close-low)/p.close:null;
  const acceptableMaxEntry=Math.min(
    ema===null?Number.POSITIVE_INFINITY:ema*(1+policy.maxEmaDistancePct),
    vwap===null?Number.POSITIVE_INFINITY:vwap*(1+policy.maxVwapDistancePct),
    atr===null?Number.POSITIVE_INFINITY:p.close+atr*0
  );
  const missing=[["EMA200",ema],["VWAP",vwap],["RSI",r],["ATR",atr],["rise24h",rise24],["rise7d",rise7],["relativeVolume",relVol],["distanceLow",distLow]].filter(([,v])=>v===null||v===undefined).map(([n])=>String(n));
  if(missing.length) return {decision:"UNAVAILABLE",reasons:[`Données manquantes: ${missing.join(", ")}`],acceptableMaxEntry:Number.isFinite(acceptableMaxEntry)?acceptableMaxEntry:null,metrics:{ema200:ema,vwap,rsi:r,atr,rise24h:rise24,rise7d:rise7,relativeVolume:relVol,distanceFromLowPct:distLow},methodologyVersion:"p0-entry-quality.v1"};
  const reasons:string[]=[];
  if((p.close-ema!)/ema!>policy.maxEmaDistancePct) reasons.push("Prix trop étendu au-dessus de l'EMA200");
  if(vwapDev!>policy.maxVwapDistancePct) reasons.push("Prix trop étendu au-dessus du VWAP");
  if(r!>policy.maxRsi) reasons.push("RSI au-dessus du seuil documenté");
  if(rise24!>policy.maxRise24hPct) reasons.push("Hausse 24 h excessive");
  if(rise7!>policy.maxRise7dPct) reasons.push("Hausse 7 j excessive");
  if(relVol!>policy.maxRelativeVolume) reasons.push("Volume relatif anormalement élevé");
  if(distLow!>policy.maxDistanceFromLowPct) reasons.push("Prix trop éloigné du dernier plus-bas 7 j");
  return {decision:reasons.length?"EXTENDED":"ACCEPTABLE",reasons:reasons.length?reasons:["Aucune extension au-delà des garde-fous documentés"],acceptableMaxEntry:Number.isFinite(acceptableMaxEntry)?acceptableMaxEntry:null,metrics:{ema200:ema,vwap,rsi:r,atr,rise24h:rise24,rise7d:rise7,relativeVolume:relVol,distanceFromLowPct:distLow},methodologyVersion:"p0-entry-quality.v1"};
}
export function assessBtcFilter(input:BtcFilterInput,policy=P0_ENTRY_POLICY):{passed:boolean;reason:string}{
  if(input.btc24hChangePct===null||input.supportBroken===null) return {passed:false,reason:"Contexte BTC UNAVAILABLE"};
  if(input.btc24hChangePct<=-policy.btcFastDrop24hPct) return {passed:false,reason:"BTC en chute rapide: ATTENDRE"};
  if(input.supportBroken) return {passed:false,reason:"BTC support confirmé cassé: ATTENDRE"};
  return {passed:true,reason:"Filtre BTC descriptif non bloquant"};
}
export function calculateSpotSwingRisk(input:SpotRiskInput):SpotRiskResult{
  const positive=[input.swingCapitalQuote,input.entryPrice,input.stopPrice,input.maxRiskPerTradePct,input.feePct,input.slippagePct,input.maxPositions,input.maxMonthlyLossPct].every(Number.isFinite)&&input.swingCapitalQuote>0&&input.entryPrice>0&&input.stopPrice>0&&input.maxRiskPerTradePct>0&&input.maxPositions>0;
  if(!positive) throw new Error("Invalid spot risk input");
  const monthlyCap=input.swingCapitalQuote*input.maxMonthlyLossPct, pauseMonthlyLoss=input.monthlyLossQuote>=monthlyCap;
  if(input.openSwingPositions>=input.maxPositions) return {allowed:false,riskBudgetQuote:0,riskPerUnitQuote:0,frictionPerUnitQuote:0,quantity:0,notionalQuote:0,maxLossQuote:0,pauseMonthlyLoss,tranches:[],reason:"Nombre maximal de positions SWING atteint",methodologyVersion:"p0-spot-risk.v1"};
  if(pauseMonthlyLoss) return {allowed:false,riskBudgetQuote:0,riskPerUnitQuote:0,frictionPerUnitQuote:0,quantity:0,notionalQuote:0,maxLossQuote:0,pauseMonthlyLoss,tranches:[],reason:"Perte mensuelle maximale atteinte: pause obligatoire",methodologyVersion:"p0-spot-risk.v1"};
  const distance=Math.abs(input.entryPrice-input.stopPrice); const friction=input.entryPrice*(input.feePct+input.slippagePct);
  const budget=input.swingCapitalQuote*input.maxRiskPerTradePct; const perUnit=distance+friction; const quantity=budget/perUnit;
  const tranches=input.tranches??[.4,.3,.3]; const sum=tranches.reduce((a,b)=>a+b,0);
  if(tranches.length<2||tranches.length>3||Math.abs(sum-1)>1e-9) throw new Error("Tranches must contain 2-3 weights summing to 1");
  return {allowed:true,riskBudgetQuote:budget,riskPerUnitQuote:distance,frictionPerUnitQuote:friction,quantity,notionalQuote:quantity*input.entryPrice,maxLossQuote:quantity*perUnit,pauseMonthlyLoss:false,tranches:tranches.map(x=>quantity*x),reason:null,methodologyVersion:"p0-spot-risk.v1"};
}
export function buildSwingDecision(input:SwingDecisionInput):SwingDecisionOutput{
  if(!input.dataAvailable) return {decision:"NE_PAS_ENTRER",reason:"Donnée obligatoire indisponible",acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
  if(input.quality.decision==="UNAVAILABLE") return {decision:"NE_PAS_ENTRER",reason:input.quality.reasons[0]??"Qualité indisponible",acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
  const btc=assessBtcFilter(input.btc);
  if(!btc.passed) return {decision:"ATTENDRE",reason:btc.reason,acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
  if(input.quality.decision==="EXTENDED") return {decision:"ATTENDRE",reason:input.quality.reasons[0]??"Prix étendu",acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
  if(!input.spotRisk.allowed) return {decision:"NE_PAS_ENTRER",reason:input.spotRisk.reason??"Risque non autorisé",acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
  return {decision:"ENTRER",reason:"Qualité d'entrée acceptable et garde-fous de risque satisfaits",acceptableEntry:input.quality.acceptableMaxEntry,pocket:"SWING"};
}

export interface PastEntry { readonly date:string; readonly entryPrice:number; readonly forwardPrices:readonly {readonly days:1|3|7;readonly price:number}[]; readonly minimumPriceAfterEntry:number|null; }
export interface PastEntryAnalysis { readonly label:"statistique historique, pas une prévision"; readonly observations:number; readonly entries:readonly {date:string;entryPrice:number;maePct:number|null;returns:Readonly<Record<1|3|7,number|null>>}[]; readonly warning:string; }
export function analyzePastEntries(entries:readonly PastEntry[]):PastEntryAnalysis{
  const rows=entries.map(e=>({date:e.date,entryPrice:e.entryPrice,maePct:e.minimumPriceAfterEntry===null?null:e.minimumPriceAfterEntry/e.entryPrice-1,returns:Object.fromEntries(([1,3,7] as const).map(d=>[d,e.forwardPrices.find(x=>x.days===d)?.price===undefined?null:e.forwardPrices.find(x=>x.days===d)!.price/e.entryPrice-1])) as Readonly<Record<1|3|7,number|null>>}));
  return {label:"statistique historique, pas une prévision",observations:rows.length,entries:rows,warning:rows.length<20?"Faible nombre d'observations: lecture descriptive uniquement.":"Lecture descriptive uniquement; aucun seuil n'est optimisé sur ces entrées."};
}
