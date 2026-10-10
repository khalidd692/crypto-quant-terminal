import { fetchJson } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance, object } from "./common.js";
import type { ContextProvenance, LiquidityContext } from "../types.js";

const S="https://stablecoins.llama.fi/stablecoincharts/all";
const B="https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const KUCOIN_STATS="https://api.kucoin.com/api/v1/market/stats?symbol=BTC-USDT";
const KUCOIN_LEVEL1="https://api.kucoin.com/api/v3/market/orderbook/level1?symbol=BTC-USDT";
const COINGECKO_CATEGORIES="https://api.coingecko.com/api/v3/coins/categories";

export function calculateSpreadBps(bid:number|null,ask:number|null):number|null{
 if(bid===null||ask===null||!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<=0||ask<bid)return null;
 const mid=(bid+ask)/2;
 if(!Number.isFinite(mid)||mid<=0)return null;
 const spread=((ask-bid)/mid)*10000;
 return Number.isFinite(spread)?spread:null;
}

export async function fetchLiquidityContext(at:string):Promise<{value:LiquidityContext;provenance:ContextProvenance[]}>{
 const [s,t,ks,kl,cg]=await Promise.allSettled([fetchJson(S),fetchJson(B),fetchJson(KUCOIN_STATS),fetchJson(KUCOIN_LEVEL1),fetchJson(COINGECKO_CATEGORIES)]);
 const sr=s.status==="fulfilled"?s.value as any:null;
 const tr=t.status==="fulfilled"?t.value as any:null;
 const kstats=ks.status==="fulfilled"?object(ks.value,KUCOIN_STATS).data as any:null;
 const kl1=kl.status==="fulfilled"?object(kl.value,KUCOIN_LEVEL1).data as any:null;
 const row=Array.isArray(sr)?sr.at(-1):null;
 const categories=cg.status==="fulfilled"&&Array.isArray(cg.value)?cg.value as any[]:[];
 const stablecoinCategory=categories.find(x=>String(x.id??"").toLowerCase()==="stablecoins"||String(x.name??"").toLowerCase().includes("stablecoin"));
 const stablecoinPrimary=numberOrNull(row?.totalCirculatingUSD),stablecoinFallback=numberOrNull(stablecoinCategory?.market_cap);
 const stablecoinMarketCapQuote=stablecoinPrimary??stablecoinFallback;
 const binanceVolume=numberOrNull(tr?.quoteVolume),kucoinVolume=numberOrNull(kstats?.volValue);
 const volume24hQuote=binanceVolume??kucoinVolume;
 const binanceBid=numberOrNull(tr?.bidPrice),binanceAsk=numberOrNull(tr?.askPrice);
 const kucoinBid=numberOrNull(kl1?.bestBid),kucoinAsk=numberOrNull(kl1?.bestAsk);
 const binanceBookValid=binanceBid!==null&&binanceAsk!==null&&binanceBid>0&&binanceAsk>=binanceBid;
 const kucoinBookValid=kucoinBid!==null&&kucoinAsk!==null&&kucoinBid>0&&kucoinAsk>=kucoinBid;
 // Keep each spread calculation within one venue; never combine one venue's bid with another's ask.
 const spreadVenue=binanceBookValid?"BINANCE":kucoinBookValid?"KUCOIN":null;
 const spreadBps=spreadVenue==="BINANCE"?calculateSpreadBps(binanceBid,binanceAsk):spreadVenue==="KUCOIN"?calculateSpreadBps(kucoinBid,kucoinAsk):null;
 const stableProv=stablecoinMarketCapQuote!==null?provenance("liquidity.stablecoinMarketCapQuote",stablecoinPrimary!==null?S:COINGECKO_CATEGORIES,at,stablecoinPrimary!==null?s.status==="fulfilled"?s.value:null:cg.status==="fulfilled"?cg.value:null):unavailableProvenance("liquidity.stablecoinMarketCapQuote",S+" + "+COINGECKO_CATEGORIES,at,"DefiLlama: "+(s.status==="rejected"?String(s.reason):"totalCirculatingUSD unavailable")+"; CoinGecko: "+(cg.status==="rejected"?String(cg.reason):"stablecoin category market_cap unavailable"));
 const volumeSource=binanceVolume!==null?B:KUCOIN_STATS;
 const volumeRaw=binanceVolume!==null?t.status==="fulfilled"?t.value:null:ks.status==="fulfilled"?ks.value:null;
 const volumeProv=volume24hQuote!==null?provenance("liquidity.volume24hQuote",volumeSource,at,volumeRaw):unavailableProvenance("liquidity.volume24hQuote",B+" + "+KUCOIN_STATS,at,"Binance: "+(t.status==="rejected"?String(t.reason):"quoteVolume unavailable")+"; KuCoin: "+(ks.status==="rejected"?String(ks.reason):"volValue unavailable"));
 const spreadSource=spreadVenue==="BINANCE"?B:KUCOIN_LEVEL1;
 const spreadRaw=spreadVenue==="BINANCE"?t.status==="fulfilled"?t.value:null:spreadVenue==="KUCOIN"?kl.status==="fulfilled"?kl.value:null:null;
 const spreadProv=spreadBps!==null?provenance("liquidity.spreadBps",spreadSource,at,spreadRaw):unavailableProvenance("liquidity.spreadBps",B+" + "+KUCOIN_LEVEL1,at,"Valid same-venue bid/ask unavailable from Binance and KuCoin");
 const venue=binanceVolume!==null||numberOrNull(tr?.bidPrice)!==null?"BINANCE":"KUCOIN";
 return {value:{venue,symbol:venue==="KUCOIN"?"BTC-USDT":"BTCUSDT",spreadBps,depthQuote:null,volume24hQuote,stablecoinMarketCapQuote,stablecoinSourceAsOf:stablecoinMarketCapQuote===null?null:at,observedAt:at},provenance:[stableProv,volumeProv,spreadProv]};
}
