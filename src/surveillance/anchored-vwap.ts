import type { MarketDataPoint } from "../domain/types.js";

export interface AnchoredVwapResult {
  readonly value: number | null;
  readonly anchorAt: string | null;
  readonly observations: number;
  readonly status: "OK" | "UNAVAILABLE";
  readonly reason: string;
}
export function calculateAnchoredVwap(
  candles: readonly MarketDataPoint[],
  anchorAt: string | null,
  asOf: string
): AnchoredVwapResult {
  if (!anchorAt || !Number.isFinite(Date.parse(anchorAt)) || !Number.isFinite(Date.parse(asOf))) {
    return { value:null, anchorAt:null, observations:0, status:"UNAVAILABLE", reason:"Creux majeur non horodaté/configuré" };
  }
  const anchorMs=Date.parse(anchorAt), asOfMs=Date.parse(asOf);
  if(anchorMs>asOfMs) return { value:null,anchorAt,observations:0,status:"UNAVAILABLE",reason:"Ancre située dans le futur" };
  const rows=candles.filter(c=>Date.parse(c.eventTime)>=anchorMs&&Date.parse(c.eventTime)<=asOfMs&&
    Number.isFinite(c.high)&&Number.isFinite(c.low)&&Number.isFinite(c.close)&&Number.isFinite(c.volume)&&
    c.high>0&&c.low>0&&c.close>0&&c.volume>0);
  if(rows.length<2) return {value:null,anchorAt,observations:rows.length,status:"UNAVAILABLE",reason:"Moins de deux bougies valides depuis le creux configuré"};
  const volume=rows.reduce((sum,c)=>sum+c.volume,0);
  const quote=rows.reduce((sum,c)=>sum+((c.high+c.low+c.close)/3)*c.volume,0);
  if(!(volume>0&&Number.isFinite(quote)&&Number.isFinite(quote/volume))) {
    return {value:null,anchorAt,observations:rows.length,status:"UNAVAILABLE",reason:"Calcul VWAP ancré non fiable"};
  }
  return {value:quote/volume,anchorAt,observations:rows.length,status:"OK",reason:"VWAP ancré calculé depuis l’horodatage de creux fourni"};
}
