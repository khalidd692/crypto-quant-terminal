import type { TelSurveillanceOutput } from "./tel-usdt.js";
export interface PreTradeChecklistItem { readonly id:string; readonly label:string; readonly passed:boolean; readonly blocking:boolean; }
export function buildTelPreTradeChecklist(output:TelSurveillanceOutput):readonly PreTradeChecklistItem[] {
  return [
    {id:"data-fresh",label:"Données KuCoin fraîches",passed:output.conditions.dataFresh===true,blocking:true},
    {id:"cross-venue",label:"Contrôle MEXC cohérent",passed:output.conditions.crossVenueOk===true,blocking:true},
    {id:"entry-zone",label:"Prix dans la zone configurée",passed:output.conditions.inEntryZone===true,blocking:true},
    {id:"trend",label:"Tendance conforme au cadre de surveillance",passed:output.conditions.trendOk===true,blocking:true},
    {id:"volatility",label:"Volatilité conforme au cadre de surveillance",passed:output.conditions.volatilityOk===true,blocking:true},
    {id:"risk",label:"Sizing / risque configuré",passed:output.conditions.sizingValid===true,blocking:true},
    {id:"rr",label:"Ratio rendement/risque >= 2",passed:Number(output.conditions.rr)>=2,blocking:true},
    {id:"degraded",label:"Aucun mode dégradé",passed:output.degraded===false,blocking:true},
  ];
}
export function canEnterTel(output:TelSurveillanceOutput):boolean {
  return output.decision==="ENTRER" && buildTelPreTradeChecklist(output).every(item=>!item.blocking||item.passed);
}