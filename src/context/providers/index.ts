import { createContextSnapshot } from "../snapshot.js";
import type {
  ContextProvenance,
  ContextSnapshot,
  CryptoMarketContext,
  EventCalendarContext,
  ExternalSeriesPoint,
  FundamentalContext,
  LiquidityContext,
  MacroContext,
  SocialSentimentContext,
  TelFundamentalContext
} from "../types.js";
import { unavailableProvenance } from "./common.js";
import { withProviderTimeout } from "../provider-guard.js";
import { fetchCryptoMarketContext } from "./crypto-market.js";
import { fetchLiquidityContext } from "./liquidity.js";
import { fetchSentimentContext } from "./sentiment.js";
import { fetchMacroContext } from "./macro.js";
import { fetchMacroEvents } from "./events.js";
import { fetchExtendedMacro } from "./extended.js";
import { fetchTelFundamentals } from "./fundamentals.js";
import { fetchTelDaily } from "./tel-price.js";
import { fetchSocialSentiment } from "./social.js";
import { correlationsForSeries } from "../correlations.js";

const PROVIDER_TIMEOUT_MS = 30_000;
const LABEL = "indice de température, bruité et manipulable, pas une prévision";
const EXTENDED_SERIES: Readonly<Record<string, string>> = {
  DTWEXBGS: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXBGS",
  SP500: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500",
  DGS10: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10",
  M2SL: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL"
};

function valuesByDay(points: readonly ExternalSeriesPoint[]): Map<string, number> {
  return new Map(points.filter(point => point.value !== null).map(point => [point.observedAt.slice(0, 10), point.value!]));
}
function aligned(tel: readonly ExternalSeriesPoint[], macro: readonly ExternalSeriesPoint[]): { t: number[]; m: number[] } {
  const telByDay = valuesByDay(tel);
  const macroByDay = valuesByDay(macro);
  const days = [...telByDay.keys()].filter(day => macroByDay.has(day)).sort();
  return { t: days.map(day => telByDay.get(day)!), m: days.map(day => macroByDay.get(day)!) };
}
function unavailable(field: string, source: string, now: string, reason: string): ContextProvenance {
  return unavailableProvenance(field, source, now, reason);
}
function unavailableMarket(now: string, reason: string) {
  const source = "crypto-market provider group";
  const value: CryptoMarketContext = {
    totalMarketCapQuote: null, btcDominancePct: null, btcReturnPct: null,
    realizedVolPct: null, breadthPct: null, fundingRatePct: null,
    openInterestQuote: null, sentimentScore: null, telFundingRate: null, telOpenInterestQuote: null
  };
  const fields = [
    "market.totalMarketCapQuote", "market.btcDominancePct", "market.btcReturnPct",
    "market.fundingRatePct", "market.openInterestQuote", "market.telFundingRate", "market.telOpenInterestQuote"
  ];
  return { value, provenance: fields.map(field => unavailable(field, source, now, reason)) };
}
function unavailableLiquidity(now: string, reason: string) {
  const source = "liquidity provider group";
  const value: LiquidityContext = {
    venue: "UNAVAILABLE", symbol: "BTC-USDT", spreadBps: null, depthQuote: null,
    volume24hQuote: null, stablecoinMarketCapQuote: null, stablecoinSourceAsOf: null, observedAt: now
  };
  return {
    value,
    provenance: [
      unavailable("liquidity.stablecoinMarketCapQuote", source, now, reason),
      unavailable("liquidity.volume24hQuote", source, now, reason),
      unavailable("liquidity.spreadBps", source, now, reason)
    ]
  };
}
function unavailableMacro(now: string, reason: string) {
  const source = "macro provider group";
  const value: MacroContext = {
    ratesBias: "UNKNOWN", inflationBias: "UNKNOWN", dollarBias: "UNKNOWN",
    policyRatePct: null, tenYearYieldPct: null, dollarIndex: null, cpiYoYPct: null, sourceAsOf: null
  };
  return {
    value,
    provenance: ["macro.DFF", "macro.DGS10", "macro.DTWEXBGS", "macro.CPIAUCSL"]
      .map(field => unavailable(field, source, now, reason))
  };
}
function unavailableEvents(now: string, reason: string) {
  const value: EventCalendarContext = { events: [] };
  return { value, provenance: unavailable("events.fomc", "Federal Reserve calendar", now, reason) };
}
function unavailableExtended(now: string, reason: string) {
  const series: Record<string, readonly ExternalSeriesPoint[]> = {};
  for (const name of Object.keys(EXTENDED_SERIES)) series[name] = [];
  return {
    series,
    provenance: Object.entries(EXTENDED_SERIES).map(([name, source]) => unavailable("macroSeries." + name, source, now, reason))
  };
}
function unavailableFundamentals(now: string, reason: string) {
  const value: TelFundamentalContext = {
    circulatingSupply: null, totalSupply: null, marketCapQuote: null, newsCount: null, latestNews: [],
    tokenUnlocks: "UNAVAILABLE", networkActivity: "UNAVAILABLE", notableFlows: "UNAVAILABLE", sourceAsOf: null
  };
  return {
    value,
    provenance: [
      unavailable("fundamentalsTel.coingecko", "CoinGecko TEL fundamentals", now, reason),
      unavailable("fundamentalsTel.newsroom", "Telcoin newsroom", now, reason)
    ]
  };
}
function unavailableTelDaily(now: string, reason: string) {
  return { series: [] as readonly ExternalSeriesPoint[], provenance: unavailable("telDaily.close", "KuCoin TEL daily candles", now, reason) };
}
function unavailableSocial(now: string, reason: string) {
  const value: SocialSentimentContext = {
    mentions: null, mentionChangePct: null, toneScore: null, concentrationTop5Pct: null,
    attentionSpike: null, temperature: "UNAVAILABLE", label: LABEL, sourceAsOf: null
  };
  return {
    value,
    provenance: [
      unavailable("social.reddit", "Reddit r/Telcoin", now, reason),
      unavailable("social.x", "X recent search", now, reason),
      unavailable("social.bluesky", "Bluesky public search", now, reason)
    ]
  };
}
function unavailableSentiment(now: string, reason: string) {
  return { score: null, provenance: unavailable("market.sentimentScore", "Alternative.me Fear & Greed", now, reason) };
}

export async function fetchContextSnapshot(
  runId: string,
  instrumentId = "TEL-USDT",
  now = new Date().toISOString()
): Promise<ContextSnapshot> {
  // Provider groups are bounded independently: one stalled service must not erase healthy live fields.
  const [market, liquidity, sentiment, macro, events, extended, fundamentals, telDaily, social] = await Promise.all([
    withProviderTimeout("crypto-market", fetchCryptoMarketContext(now), PROVIDER_TIMEOUT_MS, reason => unavailableMarket(now, reason)),
    withProviderTimeout("liquidity", fetchLiquidityContext(now), PROVIDER_TIMEOUT_MS, reason => unavailableLiquidity(now, reason)),
    withProviderTimeout("sentiment", fetchSentimentContext(now), PROVIDER_TIMEOUT_MS, reason => unavailableSentiment(now, reason)),
    withProviderTimeout("macro", fetchMacroContext(now), PROVIDER_TIMEOUT_MS, reason => unavailableMacro(now, reason)),
    withProviderTimeout("events", fetchMacroEvents(now), PROVIDER_TIMEOUT_MS, reason => unavailableEvents(now, reason)),
    withProviderTimeout("extended-macro", fetchExtendedMacro(now), PROVIDER_TIMEOUT_MS, reason => unavailableExtended(now, reason)),
    withProviderTimeout("TEL-fundamentals", fetchTelFundamentals(now), PROVIDER_TIMEOUT_MS, reason => unavailableFundamentals(now, reason)),
    withProviderTimeout("TEL-daily-price", fetchTelDaily(now), PROVIDER_TIMEOUT_MS, reason => unavailableTelDaily(now, reason)),
    withProviderTimeout("social-sentiment", fetchSocialSentiment(now), PROVIDER_TIMEOUT_MS, reason => unavailableSocial(now, reason))
  ]);
  const correlations: Record<string, ReturnType<typeof correlationsForSeries>> = {};
  for (const [name, series] of Object.entries(extended.series)) {
    const paired = aligned(telDaily.series, series);
    correlations[name] = correlationsForSeries(paired.t, paired.m);
  }
  const regime = macro.value.ratesBias === "UNKNOWN" || macro.value.dollarBias === "UNKNOWN"
    ? "UNKNOWN"
    : macro.value.ratesBias === "EASING" && macro.value.dollarBias === "WEAKENING"
      ? "RISK_ON"
      : macro.value.ratesBias === "TIGHTENING" && macro.value.dollarBias === "STRENGTHENING"
        ? "RISK_OFF"
        : "TRANSITION";
  const fundamentalsSummary: FundamentalContext = {
    protocolActivity: "UNKNOWN", developmentActivity: "UNKNOWN", valuationAssessment: "UNKNOWN", sourceAsOf: null
  };
  return createContextSnapshot({
    schemaVersion: "context-snapshot.v1", runId, instrumentId, asOf: now,
    market: { ...market.value, sentimentScore: sentiment.score },
    macro: macro.value, events: events.value, liquidity: liquidity.value,
    fundamentals: fundamentalsSummary,
    macroRegime: {
      regime, rationale: "Descriptive synthesis only; no predictive or historical-edge claim.",
      methodologyVersion: "descriptive-regime.v1"
    },
    macroSeries: { ...extended.series, TELUSDT: telDaily.series },
    correlations,
    fundamentalsTel: fundamentals.value,
    socialSentiment: social.value,
    provenance: [
      ...market.provenance, ...liquidity.provenance, sentiment.provenance, ...macro.provenance,
      events.provenance, ...extended.provenance, ...fundamentals.provenance, telDaily.provenance, ...social.provenance
    ]
  });
}
