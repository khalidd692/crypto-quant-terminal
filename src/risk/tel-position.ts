export type PositionPocket="CORE_HOLD"|"SWING";
export type ExitState="SORTIR"|"ALLÉGER"|"TENIR";
export interface ExitPlan{readonly target1:number;readonly target2:number;readonly target1Fraction:number;readonly target2Fraction:number;readonly initialStop:number;readonly trailingAtrMultiple:number;readonly timeExitDays:number;readonly pocket:PositionPocket;readonly locked:boolean;}
export const P1_DEFAULT_EXIT={target1Fraction:.5,target2Fraction:.5,trailingAtrMultiple:1.5,timeExitDays:7} as const;
export function buildExitPlan(input:{entryPrice:number;initialStop:number;target1:number;target2:number;atr:number;pocket:PositionPocket}):ExitPlan{
 if(input.pocket!=="SWING")return{target1:input.target1,target2:input.target2,target1Fraction:0,target2Fraction:0,initialStop:input.initialStop,trailingAtrMultiple:P1_DEFAULT_EXIT.trailingAtrMultiple,timeExitDays:P1_DEFAULT_EXIT.timeExitDays,pocket:"CORE_HOLD",locked:true};
 if(!(input.entryPrice>0&&input.initialStop>0&&input.initialStop<input.entryPrice&&input.target1>input.entryPrice&&input.target2>input.target1&&input.atr>0))throw new Error("Invalid swing exit plan");
 if(input.entryPrice-input.initialStop<input.atr*P1_DEFAULT_EXIT.trailingAtrMultiple)throw new Error("Initial stop is inside ATR noise floor");
 return{target1:input.target1,target2:input.target2,target1Fraction:.5,target2Fraction:.5,initialStop:input.initialStop,trailingAtrMultiple:1.5,timeExitDays:7,pocket:"SWING",locked:true};
}
export interface PositionPnl{readonly grossPct:number;readonly grossQuote:number;readonly feesQuote:number;readonly slippageQuote:number;readonly netPct:number;readonly netQuote:number;}
export function calculateSpotPnl(input:{entryPrice:number;currentPrice:number;quantity:number;entryFeePct:number;exitFeePct:number;slippagePct:number}):PositionPnl{
 if(!(input.entryPrice>0&&input.currentPrice>0&&input.quantity>0))throw new Error("Invalid position");
 const grossQuote=(input.currentPrice-input.entryPrice)*input.quantity, grossPct=input.currentPrice/input.entryPrice-1;
 const notional=(input.entryPrice+input.currentPrice)*input.quantity, feesQuote=notional*(input.entryFeePct+input.exitFeePct)/2, slippageQuote=notional*input.slippagePct/2;
 return{grossPct,grossQuote,feesQuote,slippageQuote,netPct:(grossQuote-feesQuote-slippageQuote)/(input.entryPrice*input.quantity),netQuote:grossQuote-feesQuote-slippageQuote};
}
export function evaluateExitState(input:{pocket:PositionPocket;currentPrice:number;initialStop:number;target1:number;target2:number;highestPrice:number;atr:number;entryTime:string;now:string}):{state:ExitState;reason:string;trailingStop:number|null}{
 if(input.pocket==="CORE_HOLD")return{state:"TENIR",reason:"CORE_HOLD intouchable par le moteur de sortie",trailingStop:null};
 if(!(input.currentPrice>0&&input.initialStop>0&&input.target1>0&&input.target2>input.target1&&input.highestPrice>0&&input.atr>0))return{state:"SORTIR",reason:"Configuration de sortie invalide",trailingStop:null};
 const trailingStop=input.highestPrice-input.atr*P1_DEFAULT_EXIT.trailingAtrMultiple;
 if(input.currentPrice<=input.initialStop)return{state:"SORTIR",reason:"Invalidation atteinte",trailingStop};
 if(input.currentPrice<=trailingStop&&input.highestPrice>input.target1)return{state:"SORTIR",reason:"Stop suiveur ATR atteint",trailingStop};
 if(input.currentPrice>=input.target2)return{state:"SORTIR",reason:"Palier 2 atteint",trailingStop};
 if(input.currentPrice>=input.target1)return{state:"ALLÉGER",reason:"Palier 1 atteint",trailingStop};
 const age=(Date.parse(input.now)-Date.parse(input.entryTime))/86400000;
 if(!Number.isFinite(age)||age>=P1_DEFAULT_EXIT.timeExitDays)return{state:"SORTIR",reason:"Sortie temporelle atteinte",trailingStop};
 return{state:"TENIR",reason:"Aucun déclencheur de sortie atteint",trailingStop};
}
function wilson(k:number,n:number,z=1.96):[number,number]{if(n===0)return[null as never,null as never];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n);return[(c-m)/d,(c+m)/d];}
export interface RetracementEpisode{readonly comparableRisePct:number;readonly retracementPct:number;}
export interface RetracementStats{readonly label:"statistique historique, pas une prévision";readonly observations:number;readonly frequency:number|null;readonly frequencyInterval:[number,number]|null;readonly medianRetracementPct:number|null;readonly maxRetracementPct:number|null;readonly warning:string;}
export function summarizeRetracements(episodes:readonly RetracementEpisode[],thresholdPct:number):RetracementStats{
 const valid=episodes.filter(e=>Number.isFinite(e.retracementPct)&&e.retracementPct>=0),n=valid.length,k=valid.filter(e=>e.retracementPct>=thresholdPct).length,sorted=valid.map(e=>e.retracementPct).sort((a,b)=>a-b),median=n?sorted[Math.floor((n-1)/2)]??null:null;
 return{label:"statistique historique, pas une prévision",observations:n,frequency:n?k/n:null,frequencyInterval:n?wilson(k,n):null,medianRetracementPct:median,maxRetracementPct:n?Math.max(...sorted):null,warning:n<20?"Faible nombre d'observations: intervalle et fréquence restent très incertains.":"Descriptif historique uniquement; aucun seuil n'est optimisé."};
}
export function scenarioAtPrice(input:{entryPrice:number;quantity:number;priceAfterRetracement:number;futurePrice:number}):{currentGainQuote:number;currentGainPct:number;futureGainQuote:number;futureGainPct:number}{
 if(!(input.entryPrice>0&&input.quantity>0&&input.priceAfterRetracement>0&&input.futurePrice>0))throw new Error("Invalid scenario");
 return{currentGainQuote:(input.priceAfterRetracement-input.entryPrice)*input.quantity,currentGainPct:input.priceAfterRetracement/input.entryPrice-1,futureGainQuote:(input.futurePrice-input.entryPrice)*input.quantity,futureGainPct:input.futurePrice/input.entryPrice-1};
}