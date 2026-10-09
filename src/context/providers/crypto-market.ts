import { fetchJson } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance, object } from "./common.js";
import { normalizeMexcTelDerivatives } from "./mexc-tel-derivatives.js";
import type { ContextProvenance, CryptoMarketContext } from "../types.js";

const G = "https://api.alternative.me/v2/global/?convert=USD";
const B = "https://api.alternative.me/v2/ticker/bitcoin/?convert=USD";
const F = "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT";
const O = "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT";
const MEXC_FUNDING = "https://contract.mexc.com/api/v1/contract/funding_rate/TEL_USDT";
const MEXC_TICKER = "https://contract.mexc.com/api/v1/contract/ticker?symbol=TEL_USDT";
const MEXC_DETAIL = "https://contract.mexc.com/api/v1/contract/detail/country?symbol=TEL_USDT";

export async function fetchCryptoMarketContext(at: string): Promise<{ value: CryptoMarketContext; provenance: readonly ContextProvenance[] }> {
  const p: ContextProvenance[] = [];
  const [a, b, f, o, mf, mt, md] = await Promise.allSettled([
    fetchJson(G), fetchJson(B), fetchJson(F), fetchJson(O),
    fetchJson(MEXC_FUNDING), fetchJson(MEXC_TICKER), fetchJson(MEXC_DETAIL),
  ]);
  const gd = a.status === "fulfilled" ? object(a.value, G).data as any : null;
  const bd = b.status === "fulfilled" ? object(b.value, B).data as any : null;
  const fd = f.status === "fulfilled" ? object(f.value, F) : null;
  const od = o.status === "fulfilled" ? object(o.value, O) : null;
  const g = gd?.quotes?.USD;
  const btc = bd?.["1"]?.quotes?.USD;
  const mexc = normalizeMexcTelDerivatives({
    funding: mf.status === "fulfilled" ? mf.value : null,
    ticker: mt.status === "fulfilled" ? mt.value : null,
    contract: md.status === "fulfilled" ? md.value : null,
    now: at,
    fundingError: mf.status === "rejected" ? String(mf.reason) : null,
    tickerError: mt.status === "rejected" ? String(mt.reason) : null,
    contractError: md.status === "rejected" ? String(md.reason) : null,
  });
  const value: CryptoMarketContext = {
    totalMarketCapQuote: numberOrNull(g?.total_market_cap),
    btcDominancePct: numberOrNull(gd?.bitcoin_percentage_of_market_cap),
    btcReturnPct: numberOrNull(btc?.percentage_change_24h),
    realizedVolPct: null,
    breadthPct: null,
    fundingRatePct: fd ? numberOrNull(fd.lastFundingRate) : null,
    openInterestQuote: od ? numberOrNull(od.openInterest) : null,
    sentimentScore: null,
    telFundingRate: mexc.fundingRate,
    telOpenInterestQuote: mexc.openInterestQuote,
  };
  p.push(a.status === "fulfilled" ? provenance("market.totalMarketCapQuote", G, at, a.value) : unavailableProvenance("market.totalMarketCapQuote", G, at, String(a.reason)));
  p.push(a.status === "fulfilled" ? provenance("market.btcDominancePct", G, at, a.value) : unavailableProvenance("market.btcDominancePct", G, at, String(a.reason)));
  p.push(b.status === "fulfilled" ? provenance("market.btcReturnPct", B, at, b.value) : unavailableProvenance("market.btcReturnPct", B, at, String(b.reason)));
  p.push(f.status === "fulfilled" ? provenance("market.fundingRatePct", F, at, f.value) : unavailableProvenance("market.fundingRatePct", F, at, String(f.reason)));
  p.push(o.status === "fulfilled" ? provenance("market.openInterestQuote", O, at, o.value) : unavailableProvenance("market.openInterestQuote", O, at, String(o.reason)));
  p.push(mexc.fundingRate === null
    ? unavailableProvenance("market.telFundingRate", MEXC_FUNDING, at, mexc.fundingReason ?? "MEXC TEL funding unavailable")
    : provenance("market.telFundingRate", MEXC_FUNDING, at, mf.status === "fulfilled" ? mf.value : null));
  p.push(mexc.openInterestQuote === null
    ? unavailableProvenance("market.telOpenInterestQuote", MEXC_TICKER + " + " + MEXC_DETAIL, at, mexc.openInterestReason ?? "MEXC TEL open interest unavailable")
    : provenance("market.telOpenInterestQuote", MEXC_TICKER + " + " + MEXC_DETAIL, at, {
        ticker: mt.status === "fulfilled" ? mt.value : null,
        contract: md.status === "fulfilled" ? md.value : null,
      }));
  return { value, provenance: p };
}
