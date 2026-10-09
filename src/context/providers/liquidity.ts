import { fetchJson } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance, object } from "./common.js";
import type { ContextProvenance, LiquidityContext } from "../types.js";

const S="https://stablecoins.llama.fi/stablecoincharts/all";
const B="https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const KUCOIN_STATS="https://api.kucoin.com/api/v1/market/stats?symbol=BTC-USDT";
const KUCOIN_LEVEL1="https://api.kucoin.com/api/v3/market/orderbook/level1?symbol=BTC-USDT";

export async function fetchLiquidityContext(at:string):Promise<{value:LiquidityContext;provenance:ContextProvenance[]}>{
 const [s,t,ks,kl]=await Promise.allSettled([fetchJson(S),fetchJson(B),fetchJson(KUCOIN_STATS),fetchJson(KUCOIN_LEVEL1)]);
 const sr=s.status==="fulfilled"?s.value as any:null;
 const tr=t.status==="fulfilled"?t.value as any:null;
 const kstats=ks.status==="fulfilled"?object(ks.value,KUCOIN_STATS).data as any:null;
 const kl1=kl.status==="fulfilled"?object(kl.value,KUCOIN_LEVEL1).data as any:null;
 const row=Array.isArray(sr)?sr.at(-1):null;
 const stablecoinMarketCapQuote=numberOrNull(row?.totalCirculatingUSD);
 const binanceVolume=numberOrNull(tr?.quoteVolume),kucoinVolume=numberOrNull(kstats?.volValue);
 const volume24hQuote=binanceVolume??kucoinVolume;
 const bid=numberOrNull(tr?.bidPrice)??numberOrNull(kl1?.bestBid);
 const ask=numberOrNull(tr?.askPrice)??numberOrNull(kl1?.bestAsk);
 const last=numberOrNull(tr?.lastPrice)??numberOrNull(kl1?.price);
 const spreadBps=bid!==null&&ask!==null&&last!==null&&last>0?((ask-bid)/last)*10000:null;
 const stableProv=s.status==="fulfilled"&&stablecoinMarketCapQuote!==null?provenance("liquidity.stablecoinMarketCapQuote",S,at,s.value):unavailableProvenance("liquidity.stablecoinMarketCapQuote",S,at,s.status==="fulfilled"?"Stablecoin value missing":String(s.reason));
 const volumeSource=binanceVolume!==null?B:KUCOIN_STATS;
 const volumeRaw=binanceVolume!==null?t.status==="fulfilled"?t.value:null:ks.status==="fulfilled"?ks.value:null;
 const volumeProv=volume24hQuote!==null?provenance("liquidity.volume24hQuote",volumeSource,at,volumeRaw):unavailableProvenance("liquidity.volume24hQuote",B+" + "+KUCOIN_STATS,at,"Binance: "+(t.status==="rejected"?String(t.reason):"quoteVolume unavailable")+"; KuCoin: "+(ks.status==="rejected"?String(ks.reason):"volValue unavailable"));
 const spreadSource=numberOrNull(tr?.bidPrice)!==null&&numberOrNull(tr?.askPrice)!==null?B:KUCOIN_LEVEL1;
 const spreadRaw=spreadSource===B?t.status==="fulfilled"?t.value:null:kl.status==="fulfilled"?kl.value:null;
 const spreadProv=spreadBps!==null?provenance("liquidity.spreadBps",spreadSource,at,spreadRaw):unavailableProvenance("liquidity.spreadBps",B+" + "+KUCOIN_LEVEL1,at,"Bid/ask/last unavailable from Binance and KuCoin");
 const venue=binanceVolume!==null||numberOrNull(tr?.bidPrice)!==null?"BINANCE":"KUCOIN";
 return {value:{venue,symbol:venue==="KUCOIN"?"BTC-USDT":"BTCUSDT",spreadBps,depthQuote:null,volume24hQuote,stablecoinMarketCapQuote,stablecoinSourceAsOf:stablecoinMarketCapQuote===null?null:at,observedAt:at},provenance:[stableProv,volumeProv,spreadProv,unavailableProvenance("liquidity.depthQuote",KUCOIN_LEVEL1,at,"Only level-1 bid/ask is collected; depth is not fetched")]};
}
