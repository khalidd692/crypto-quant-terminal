import { fetchJson } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance, object } from "./common.js";
import type { ContextProvenance, LiquidityContext } from "../types.js";

const STABLECOINS = "https://stablecoins.llama.fi/stablecoincharts/all";
const BTC_TICKER = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const KUCOIN_STATS = "https://api.kucoin.com/api/v1/market/stats?symbol=BTC-USDT";
const COINGECKO_CATEGORIES = "https://api.coingecko.com/api/v3/coins/categories";
const KUCOIN_TEL_BOOK = "https://api.kucoin.com/api/v3/market/orderbook/level2_20?symbol=TEL-USDT";
const MEXC_TEL_BOOK = "https://api.mexc.com/api/v3/depth?symbol=TELUSDT&limit=5";

type RawBook = { bids?: unknown; asks?: unknown; data?: { bids?: unknown; asks?: unknown } };

export function calculateSpreadBps(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null || !Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0 || ask < bid) return null;
  const mid = (ask + bid) / 2;
  if (!Number.isFinite(mid) || mid <= 0) return null;
  const spread = ((ask - bid) / mid) * 10_000;
  return Number.isFinite(spread) ? spread : null;
}

function bestPrice(levels: unknown, side: "bid" | "ask"): number | null {
  if (!Array.isArray(levels) || levels.length === 0) return null;
  const prices = levels.flatMap(level => {
    const raw = Array.isArray(level) ? level[0] : null;
    const price = numberOrNull(raw);
    return price !== null && price > 0 ? [price] : [];
  });
  if (prices.length === 0) return null;
  return side === "bid" ? Math.max(...prices) : Math.min(...prices);
}

export function spreadFromOrderBook(raw: unknown): number | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as RawBook;
  const payload = root.data && typeof root.data === "object" ? root.data : root;
  const bid = bestPrice(payload.bids, "bid");
  const ask = bestPrice(payload.asks, "ask");
  return calculateSpreadBps(bid, ask);
}

export function conservativeTelSpread(
  kucoinSpreadBps: number | null,
  mexcSpreadBps: number | null,
): number | null {
  const available = [kucoinSpreadBps, mexcSpreadBps]
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  return available.length ? Math.max(...available) : null;
}

export async function fetchLiquidityContext(at: string): Promise<{
  value: LiquidityContext;
  provenance: ContextProvenance[];
}> {
  const [stable, btcTicker, kucoinStats, categories, kucoinBook, mexcBook] = await Promise.allSettled([
    fetchJson(STABLECOINS),
    fetchJson(BTC_TICKER),
    fetchJson(KUCOIN_STATS),
    fetchJson(COINGECKO_CATEGORIES),
    fetchJson(KUCOIN_TEL_BOOK),
    fetchJson(MEXC_TEL_BOOK),
  ]);

  const stableRows = stable.status === "fulfilled" && Array.isArray(stable.value) ? stable.value as any[] : [];
  const stableRow = stableRows.at(-1);
  const categoryRows = categories.status === "fulfilled" && Array.isArray(categories.value) ? categories.value as any[] : [];
  const stablecoinCategory = categoryRows.find(row =>
    String(row?.id ?? "").toLowerCase() === "stablecoins" ||
    String(row?.name ?? "").toLowerCase().includes("stablecoin")
  );
  const stablecoinPrimary = numberOrNull(stableRow?.totalCirculatingUSD);
  const stablecoinFallback = numberOrNull(stablecoinCategory?.market_cap);
  const stablecoinMarketCapQuote = stablecoinPrimary ?? stablecoinFallback;

  const ticker = btcTicker.status === "fulfilled" ? btcTicker.value as any : null;
  const stats = kucoinStats.status === "fulfilled" ? object(kucoinStats.value, KUCOIN_STATS).data as any : null;
  const volume24hQuote = numberOrNull(ticker?.quoteVolume) ?? numberOrNull(stats?.volValue);

  const kucoinSpread = kucoinBook.status === "fulfilled" ? spreadFromOrderBook(kucoinBook.value) : null;
  const mexcSpread = mexcBook.status === "fulfilled" ? spreadFromOrderBook(mexcBook.value) : null;
  // Use the wider verified live TEL/USDT spread so one liquid venue cannot mask a bad book on the other.
  const spreadBps = conservativeTelSpread(kucoinSpread, mexcSpread);
  const spreadVenue = kucoinSpread !== null && mexcSpread !== null
    ? "KUCOIN+MEXC"
    : kucoinSpread !== null ? "KUCOIN" : mexcSpread !== null ? "MEXC" : "UNAVAILABLE";

  const stableProv = stablecoinMarketCapQuote !== null
    ? provenance("liquidity.stablecoinMarketCapQuote", stablecoinPrimary !== null ? STABLECOINS : COINGECKO_CATEGORIES, at,
      stablecoinPrimary !== null ? stable.status === "fulfilled" ? stable.value : null : categories.status === "fulfilled" ? categories.value : null)
    : unavailableProvenance("liquidity.stablecoinMarketCapQuote", STABLECOINS + " + " + COINGECKO_CATEGORIES, at,
      "DefiLlama: " + (stable.status === "rejected" ? String(stable.reason) : "totalCirculatingUSD unavailable") +
      "; CoinGecko: " + (categories.status === "rejected" ? String(categories.reason) : "stablecoin category market_cap unavailable"));

  const volumeSource = numberOrNull(ticker?.quoteVolume) !== null ? BTC_TICKER : KUCOIN_STATS;
  const volumeRaw = numberOrNull(ticker?.quoteVolume) !== null
    ? btcTicker.status === "fulfilled" ? btcTicker.value : null
    : kucoinStats.status === "fulfilled" ? kucoinStats.value : null;
  const volumeProv = volume24hQuote !== null
    ? provenance("liquidity.volume24hQuote", volumeSource, at, volumeRaw)
    : unavailableProvenance("liquidity.volume24hQuote", BTC_TICKER + " + " + KUCOIN_STATS, at,
      "Binance: " + (btcTicker.status === "rejected" ? String(btcTicker.reason) : "quoteVolume unavailable") +
      "; KuCoin: " + (kucoinStats.status === "rejected" ? String(kucoinStats.reason) : "volValue unavailable"));

  const kucoinProv = kucoinSpread !== null
    ? provenance("liquidity.spreadBps.KUCOIN_TEL_USDT", KUCOIN_TEL_BOOK, at, kucoinBook.status === "fulfilled" ? kucoinBook.value : null)
    : unavailableProvenance("liquidity.spreadBps.KUCOIN_TEL_USDT", KUCOIN_TEL_BOOK, at,
      kucoinBook.status === "rejected" ? String(kucoinBook.reason) : "Valid TEL-USDT bids/asks unavailable from KuCoin");
  const mexcProv = mexcSpread !== null
    ? provenance("liquidity.spreadBps.MEXC_TEL_USDT", MEXC_TEL_BOOK, at, mexcBook.status === "fulfilled" ? mexcBook.value : null)
    : unavailableProvenance("liquidity.spreadBps.MEXC_TEL_USDT", MEXC_TEL_BOOK, at,
      mexcBook.status === "rejected" ? String(mexcBook.reason) : "Valid TELUSDT bids/asks unavailable from MEXC");
  const spreadProv = spreadBps !== null
    ? provenance("liquidity.spreadBps", spreadVenue === "KUCOIN" ? KUCOIN_TEL_BOOK : spreadVenue === "MEXC" ? MEXC_TEL_BOOK : KUCOIN_TEL_BOOK + " + " + MEXC_TEL_BOOK, at,
      { kucoinSpreadBps: kucoinSpread, mexcSpreadBps: mexcSpread })
    : unavailableProvenance("liquidity.spreadBps", KUCOIN_TEL_BOOK + " + " + MEXC_TEL_BOOK, at,
      "Valid live TEL/USDT order books unavailable from KuCoin and MEXC");

  return {
    value: {
      venue: spreadVenue,
      symbol: "TEL-USDT",
      spreadBps,
      depthQuote: null,
      volume24hQuote,
      stablecoinMarketCapQuote,
      stablecoinSourceAsOf: stablecoinMarketCapQuote === null ? null : at,
      observedAt: at,
    },
    provenance: [stableProv, volumeProv, kucoinProv, mexcProv, spreadProv],
  };
}
