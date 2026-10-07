import type { ReturnSummary, DrawdownSummary } from "./report.js";
export function summaryForReturns(values: readonly number[]): ReturnSummary {
  if (!values.length) return { count: 0, mean: null, median: null, sum: 0, positiveFraction: null, max: null, min: null };
  const sorted=[...values].sort((a,b)=>a-b), sum=values.reduce((a,b)=>a+b,0), m=Math.floor(sorted.length/2);
  return { count:values.length, mean:sum/values.length, median:sorted.length%2?sorted[m]!:((sorted[m-1]??0)+(sorted[m]??0))/2, sum, positiveFraction:values.filter(v=>v>0).length/values.length, max:sorted.at(-1)??null, min:sorted[0]??null };
}
export function drawdownForReturns(values: readonly number[]): DrawdownSummary {
  let equity=1, peak=1, max=-0, peakIndex:null|number=null, troughIndex:null|number=null, maxFrac=0;
  values.forEach((v,i)=>{equity+=v;if(equity>peak){peak=equity;peakIndex=i;}const dd=equity-peak;if(dd<max){max=dd;troughIndex=i;maxFrac=Math.abs(dd)/peak;}});
  return {maxDrawdownR:max,maxDrawdownFraction:maxFrac,peakIndex,troughIndex};
}
