import { fetchJson } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance, object } from "./common.js";
import { normalizeMexcTelDerivatives } from "./mexc-tel-derivatives.js";
import type { ContextProvenance, CryptoMarketContext } from "../types.js";

const G = "https://api.alternative.me/v2/global/?convert=USD";
const B = "https://api.alternative.me/v2/ticker/bitcoin/?convert=USD";
const F = "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT";
const O = "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT";
const KUCOIN_FUNDING = "https://api-futures.kucoin.com/api/v1/funding-rate/XBTUSDTM/current";
const KUCOIN_CONTRACT = "https://api-futures.kucoin.com/api/v1/contracts/XBTUSDTM";
const MEXC_FUNDING = "https://contract.mexc.com/api/v1/contract/funding_rate/TEL_USDT";
const MEXC_TICKER = "https://contract.mexc.com/api/v1/contract/ticker?symbol=TEL_USDT";
const MEXC_DETAIL = "https://contract.mexc.com/api/v1/contract/detail/country?symbol=TEL_USDT";

export async function fetchCryptoMarketContext(at: string): Promise<{ value: CryptoMarketContext; provenance: readonly ContextProvenance[] }> {
  const p: ContextProvenance[] = [];
  const [a,b,f,o,kf,kc,mf,mt,md] = await Promise.allSettled([
    fetchJson(G),fetchJson(B),fetchJson(F),fetchJson(O),fetchJson(KUCOIN_FUNDING),fetchJson(KUCOIN_CONTRACT),
    fetchJson(MEXC_FUNDING),fetchJson(MEXC_TICKER),fetchJson(MEXC_DETAIL),
  ]);
  const gd=a.status==="fulfilled"?object(a.value,G).data as any:null;
  const bd=b.status==="fulfilled"?object(b.value,B).data as any:null;
  const fd=f.status==="fulfilled"?object(f.value,F):null;
  const od=o.status==="fulfilled"?object(o.value,O):null;
  const kfd=kf.status==="fulfilled"?object(kf.value,KUCOIN_FUNDING).data as any:null;
  const kcd=kc.status==="fulfilled"?object(kc.value,KUCOIN_CONTRACT).data as any:null;
  const g=gd?.quotes?.USD;
  const btc=bd?.["1"]?.quotes?.USD;
  const totalMarketCapQuote=numberOrNull(g?.total_market_cap);
  const btcDominancePct=numberOrNull(gd?.bitcoin_percentage_of_market_cap);
  const btcReturnPct=numberOrNull(btc?.percentage_change_24h);
  const binanceFunding=numberOrNull(fd?.lastFundingRate);
  const kucoinFunding=numberOrNull(kfd?.value);
  const fundingValue=binanceFunding??kucoinFunding;
  const fundingSource=binanceFunding!==null?F:KUCOIN_FUNDING;
  const binanceOpenInterest=numberOrNull(od?.openInterest);
  const oiContracts=numberOrNull(kcd?.openInterest);
  const multiplier=numberOrNull(kcd?.multiplier);
  const markPrice=numberOrNull(kcd?.markPrice);
  const kucoinOpenInterest=oiContracts!==null&&multiplier!==null&&markPrice!==null?oiContracts*multiplier*markPrice:null;
  const openInterestValue=binanceOpenInterest??kucoinOpenInterest;
  const openInterestSource=binanceOpenInterest!==null?O:KUCOIN_CONTRACT;
  const mexc=normalizeMexcTelDerivatives({
    funding:mf.status==="fulfilled"?mf.value:null,ticker:mt.status==="fulfilled"?mt.value:null,contract:md.status==="fulfilled"?md.value:null,now:at,
    fundingError:mf.status==="rejected"?String(mf.reason):null,tickerError:mt.status==="rejected"?String(mt.reason):null,contractError:md.status==="rejected"?String(md.reason):null,
  });
  const value:CryptoMarketContext={
    totalMarketCapQuote,btcDominancePct,
    btcReturnPct,realizedVolPct:null,breadthPct:null,
    fundingRatePct:fundingValue,openInterestQuote:openInterestValue,sentimentScore:null,
    telFundingRate:mexc.fundingRate,telOpenInterestQuote:mexc.openInterestQuote,
  };
  p.push(a.status==="fulfilled"&&totalMarketCapQuote!==null?provenance("market.totalMarketCapQuote",G,at,a.value):unavailableProvenance("market.totalMarketCapQuote",G,at,a.status==="rejected"?String(a.reason):"total_market_cap missing from live response"));
  p.push(a.status==="fulfilled"&&btcDominancePct!==null?provenance("market.btcDominancePct",G,at,a.value):unavailableProvenance("market.btcDominancePct",G,at,a.status==="rejected"?String(a.reason):"bitcoin_percentage_of_market_cap missing from live response"));
  p.push(b.status==="fulfilled"&&btcReturnPct!==null?provenance("market.btcReturnPct",B,at,b.value):unavailableProvenance("market.btcReturnPct",B,at,b.status==="rejected"?String(b.reason):"percentage_change_24h missing from live response"));
  p.push(fundingValue!==null?provenance("market.fundingRatePct",fundingSource,at,fundingSource===F?f.status==="fulfilled"?f.value:null:kf.status==="fulfilled"?kf.value:null):unavailableProvenance("market.fundingRatePct",F+" + "+KUCOIN_FUNDING,at,"Binance: "+(f.status==="rejected"?String(f.reason):"funding field unavailable")+"; KuCoin: "+(kf.status==="rejected"?String(kf.reason):"funding field unavailable")));
  p.push(openInterestValue!==null?provenance("market.openInterestQuote",openInterestSource,at,openInterestSource===O?o.status==="fulfilled"?o.value:null:kc.status==="fulfilled"?kc.value:null):unavailableProvenance("market.openInterestQuote",O+" + "+KUCOIN_CONTRACT,at,"Binance: "+(o.status==="rejected"?String(o.reason):"open interest unavailable")+"; KuCoin: "+(kc.status==="rejected"?String(kc.reason):"openInterest, multiplier, or markPrice unavailable")));
  p.push(mexc.fundingRate===null?unavailableProvenance("market.telFundingRate",MEXC_FUNDING,at,mexc.fundingReason??"MEXC TEL funding unavailable"):provenance("market.telFundingRate",MEXC_FUNDING,at,mf.status==="fulfilled"?mf.value:null));
  p.push(mexc.openInterestQuote===null?unavailableProvenance("market.telOpenInterestQuote",MEXC_TICKER+" + "+MEXC_DETAIL,at,mexc.openInterestReason??"MEXC TEL open interest unavailable"):provenance("market.telOpenInterestQuote",MEXC_TICKER+" + "+MEXC_DETAIL,at,{ticker:mt.status==="fulfilled"?mt.value:null,contract:md.status==="fulfilled"?md.value:null}));
  return {value,provenance:p};
}
