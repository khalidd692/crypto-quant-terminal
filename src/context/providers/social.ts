import { fetchJson } from "./http.js";
import { provenance, unavailableProvenance } from "./common.js";
import type { ContextProvenance, SocialSentimentContext } from "../types.js";

const REDDIT = "https://www.reddit.com/r/Telcoin/search.json?q=TEL&restrict_sr=1&sort=new&limit=100";
const X_SEARCH = "https://api.x.com/2/tweets/search/recent?query=(TEL%20OR%20Telcoin)%20-is:retweet&max_results=100&tweet.fields=author_id,created_at,text";
const BLUESKY_SEARCHES = [
  "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=telcoin&sort=latest&limit=100",
  "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=telcoin&sort=latest&limit=100"
] as const;
const BLUESKY_HEADERS = {
  "user-agent": "crypto-quant-terminal/1.0 (read-only research; https://github.com/khalidd692/crypto-quant-terminal)"
} as const;
const POS = ["bull", "bullish", "breakout", "moon", "buy", "partnership", "adoption", "launch", "growth", "bank", "regulated", "positive"];
const NEG = ["bear", "bearish", "dump", "sell", "scam", "lawsuit", "hack", "risk", "negative", "unlock"];

function tone(text: string): number {
  const t = text.toLowerCase();
  const p = POS.filter(word => t.includes(word)).length;
  const n = NEG.filter(word => t.includes(word)).length;
  return p + n === 0 ? 0 : (p - n) / (p + n);
}

function build(items: readonly any[], at: string): SocialSentimentContext {
  const texts = items.map(item => String(item?.data?.title ?? item?.data?.selftext ?? item?.text ?? "")).filter(Boolean);
  const authors = items.map(item => String(item?.data?.author ?? item?.author_id ?? "")).filter(Boolean);
  const mid = Math.floor(texts.length / 2);
  const old = mid ? texts.slice(mid) : [];
  const recent = texts.slice(0, mid);
  const oldRate = old.length ? old.length : 0;
  const recentRate = recent.length;
  const mentionChangePct = oldRate ? recentRate / oldRate - 1 : null;
  const scores = texts.map(tone);
  const toneScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const counts = new Map<string, number>();
  for (const author of authors) counts.set(author, (counts.get(author) ?? 0) + 1);
  const top5 = [...counts.values()].sort((a, b) => b - a).slice(0, 5).reduce((sum, count) => sum + count, 0);
  const concentrationTop5Pct = authors.length ? top5 / authors.length : null;
  const attentionSpike = mentionChangePct !== null ? mentionChangePct >= 1 : null;
  const hot = attentionSpike === true && (toneScore ?? 0) >= 0.25;
  return {
    mentions: texts.length, mentionChangePct, toneScore, concentrationTop5Pct, attentionSpike,
    temperature: hot ? "HOT" : attentionSpike ? "NEUTRAL" : "LOW",
    label: "indice de température, bruité et manipulable, pas une prévision", sourceAsOf: at
  };
}

function unavailable(): SocialSentimentContext {
  return {
    mentions: null, mentionChangePct: null, toneScore: null, concentrationTop5Pct: null,
    attentionSpike: null, temperature: "UNAVAILABLE",
    label: "indice de température, bruité et manipulable, pas une prévision", sourceAsOf: null
  };
}

export async function fetchSocialSentiment(at: string): Promise<{ value: SocialSentimentContext; provenance: ContextProvenance[] }> {
  const provenanceItems: ContextProvenance[] = [];
  let selectedItems: any[] | null = null;

  try {
    const raw = await fetchJson(REDDIT) as any;
    if (!Array.isArray(raw?.data?.children)) throw new Error("Reddit response schema unavailable");
    const posts = raw.data.children.filter((item: any) =>
      String(item?.data?.title ?? item?.data?.selftext ?? "").trim().length > 0
    );
    if (posts.length === 0) throw new Error("Reddit returned no usable TEL posts");
    selectedItems = posts;
    provenanceItems.push(provenance("social.reddit", REDDIT, at, raw));

  } catch (error) {
    provenanceItems.push(unavailableProvenance("social.reddit", REDDIT, at, String(error)));
  }

  const token = process.env.X_BEARER_TOKEN;
  if (token) {
    try {
      const response = await fetch(X_SEARCH, {
        headers: { accept: "application/json", authorization: "Bearer " + token },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("X HTTP " + response.status);
      const raw = await response.json() as any;
      if (!Array.isArray(raw?.data)) throw new Error("X response schema unavailable");
      const posts = raw.data.filter((item: any) => String(item?.text ?? "").trim().length > 0);
      if (posts.length === 0) throw new Error("X returned no usable TEL posts");
      if (selectedItems === null) selectedItems = posts;
      provenanceItems.push(provenance("social.x", X_SEARCH, at, raw));

    } catch (error) {
      provenanceItems.push(unavailableProvenance("social.x", X_SEARCH, at, String(error)));
    }
  } else {
    provenanceItems.push(unavailableProvenance("social.x", X_SEARCH, at, "X_BEARER_TOKEN not configured"));
  }

  // Public Bluesky search is an unauthenticated fallback when Reddit/X cannot
  // provide usable posts. Try the documented cached host first, then its API
  // host; never override a usable primary social source or count empty results.
  if (selectedItems === null) {
    let failure = "No Bluesky endpoint returned usable posts";
    for (const url of BLUESKY_SEARCHES) {
      try {
        const raw = await fetchJson(url, BLUESKY_HEADERS) as any;
        if (!Array.isArray(raw?.posts)) throw new Error("Bluesky response schema unavailable");
        const posts = raw.posts.map((post: any) => ({
          text: post?.record?.text,
          author_id: post?.author?.did ?? post?.author?.handle
        })).filter((post: any) => typeof post.text === "string" && post.text.trim().length > 0);
        if (posts.length === 0) throw new Error("Bluesky returned no usable TEL posts");
        selectedItems = posts;
        provenanceItems.push(provenance("social.bluesky", url, at, raw));
        break;
      } catch (error) {
        failure = url + ": " + String(error);
      }
    }
    if (selectedItems === null) {
      provenanceItems.push(unavailableProvenance("social.bluesky", BLUESKY_SEARCHES.join(" ; "), at, failure));
    }
  }

  return {
    value: selectedItems !== null ? build(selectedItems, at) : unavailable(),
    provenance: provenanceItems
  };
}
