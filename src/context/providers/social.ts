import { provenance, unavailableProvenance } from "./common.js";
import type { ContextProvenance, SocialSentimentContext } from "../types.js";

const REDDIT_SEARCH = "https://oauth.reddit.com/r/Telcoin/search.json?q=TEL&restrict_sr=1&sort=new&limit=100";
const X_SEARCH = "https://api.x.com/2/tweets/search/recent?query=(TEL%20OR%20Telcoin)%20-is:retweet&max_results=100&tweet.fields=author_id,created_at,text";
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
  const mid = Math.floor(texts.length / 2), old = mid ? texts.slice(mid) : [], recent = texts.slice(0, mid);
  const mentionChangePct = old.length ? recent.length / old.length - 1 : null;
  const scores = texts.map(tone), toneScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const counts = new Map<string, number>();
  for (const author of authors) counts.set(author, (counts.get(author) ?? 0) + 1);
  const top5 = [...counts.values()].sort((a,b)=>b-a).slice(0,5).reduce((sum,count)=>sum+count,0);
  const concentrationTop5Pct = authors.length ? top5 / authors.length : null;
  const attentionSpike = mentionChangePct !== null ? mentionChangePct >= 1 : null;
  const hot = attentionSpike === true && (toneScore ?? 0) >= 0.25;
  return { mentions:texts.length,mentionChangePct,toneScore,concentrationTop5Pct,attentionSpike,temperature:hot?"HOT":attentionSpike?"NEUTRAL":"LOW",label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:at };
}
function unavailable(): SocialSentimentContext {
  return {mentions:null,mentionChangePct:null,toneScore:null,concentrationTop5Pct:null,attentionSpike:null,temperature:"UNAVAILABLE",label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:null};
}
function safeCause(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Never echo credentials or authorization headers into provenance/log output.
  return message.replace(/(Bearer\s+)\S+/gi,"$1[REDACTED]").replace(/(Basic\s+)\S+/gi,"$1[REDACTED]").slice(0,240);
}
export async function fetchSocialSentiment(at: string): Promise<{value:SocialSentimentContext;provenance:ContextProvenance[]}> {
  const provenanceItems: ContextProvenance[] = [];
  let redditItems: any[] | null = null;
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    provenanceItems.push(unavailableProvenance("social.reddit",REDDIT_SEARCH,at,"REDDIT_OAUTH_CREDENTIALS_MISSING"));
  } else {
    try {
      const auth = Buffer.from(clientId + ":" + clientSecret,"utf8").toString("base64");
      const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token",{
        method:"POST",headers:{authorization:"Basic "+auth,"content-type":"application/x-www-form-urlencoded","user-agent":"KHALYON/1.0 (read-only sentiment monitor)"},
        body:"grant_type=client_credentials",signal:AbortSignal.timeout(8000)
      });
      if (!tokenResponse.ok) throw new Error("REDDIT_OAUTH_HTTP_"+tokenResponse.status);
      const tokenPayload = await tokenResponse.json() as any;
      if (typeof tokenPayload?.access_token!=="string" || !tokenPayload.access_token) throw new Error("REDDIT_OAUTH_TOKEN_MISSING");
      const response = await fetch(REDDIT_SEARCH,{
        headers:{authorization:"Bearer "+tokenPayload.access_token,accept:"application/json","user-agent":"KHALYON/1.0 (read-only sentiment monitor)"},
        signal:AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("REDDIT_SEARCH_HTTP_"+response.status);
      const raw=await response.json() as any;
      if(!Array.isArray(raw?.data?.children))throw new Error("REDDIT_RESPONSE_SCHEMA_UNAVAILABLE");
      redditItems=raw.data.children;
      provenanceItems.push(provenance("social.reddit",REDDIT_SEARCH,at,raw));
    } catch(error) {
      provenanceItems.push(unavailableProvenance("social.reddit",REDDIT_SEARCH,at,safeCause(error)));
    }
  }
  const xToken=process.env.X_BEARER_TOKEN;
  if(xToken) {
    try {
      const response=await fetch(X_SEARCH,{headers:{accept:"application/json",authorization:"Bearer "+xToken},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error("X_HTTP_"+response.status);
      const raw=await response.json() as any;
      if(!Array.isArray(raw?.data))throw new Error("X_RESPONSE_SCHEMA_UNAVAILABLE");
      provenanceItems.push(provenance("social.x",X_SEARCH,at,raw));
    } catch(error) {
      provenanceItems.push(unavailableProvenance("social.x",X_SEARCH,at,safeCause(error)));
    }
  } else provenanceItems.push(unavailableProvenance("social.x",X_SEARCH,at,"X_BEARER_TOKEN not configured"));
  // Reddit is the required social input. X cannot silently replace a missing/blocked Reddit source.
  return {value:redditItems!==null?build(redditItems,at):unavailable(),provenance:provenanceItems};
}
