import { fetchJson } from "./http.js";
import { numberOrNull,provenance,unavailableProvenance } from "./common.js";
import type { ContextProvenance,SocialSentimentContext } from "../types.js";
const REDDIT="https://www.reddit.com/r/Telcoin/search.json?q=TEL&restrict_sr=1&sort=new&limit=100";
const REDDIT_FALLBACK="https://old.reddit.com/r/Telcoin/search.json?q=TEL&restrict_sr=1&sort=new&limit=100";
const X_SEARCH="https://api.x.com/2/tweets/search/recent?query=(TEL%20OR%20Telcoin)%20-is:retweet&max_results=100&tweet.fields=author_id,created_at,text";
const POS=["bull","bullish","breakout","moon","buy","partnership","adoption","launch","growth","bank","regulated","positive"];
const NEG=["bear","bearish","dump","sell","scam","lawsuit","hack","risk","negative","unlock"];
function tone(text:string):number{const t=text.toLowerCase();const p=POS.filter(w=>t.includes(w)).length,n=NEG.filter(w=>t.includes(w)).length;return p+n===0?0:(p-n)/(p+n);}
function build(items:readonly any[],at:string):SocialSentimentContext{const texts=items.map(x=>String(x?.data?.title??x?.data?.selftext??x?.text??"")).filter(Boolean),authors=items.map(x=>String(x?.data?.author??x?.author_id??"")).filter(Boolean),mid=Math.floor(texts.length/2),old=mid?texts.slice(mid):[],recent=texts.slice(0,mid),oldRate=old.length?old.length:0,recentRate=recent.length;const mentionChangePct=oldRate?recentRate/oldRate-1:null;const scores=texts.map(tone),toneScore=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;const counts=new Map<string,number>();for(const a of authors)counts.set(a,(counts.get(a)??0)+1);const top5=[...counts.values()].sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0),concentrationTop5Pct=authors.length?top5/authors.length:null;const attentionSpike=mentionChangePct!==null?mentionChangePct>=1:null;const hot=attentionSpike===true&&(toneScore??0)>=.25;return{mentions:texts.length,mentionChangePct,toneScore,concentrationTop5Pct,attentionSpike,temperature:hot?"HOT":attentionSpike?"NEUTRAL":"LOW",label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:at};}
export async function fetchSocialSentiment(at:string):Promise<{value:SocialSentimentContext;provenance:ContextProvenance[]}>{
 let raw:any=null,source=REDDIT;const errors:string[]=[];
 for(const url of [REDDIT,REDDIT_FALLBACK]){try{const candidate=await fetchJson(url) as any;if(Array.isArray(candidate?.data?.children)){raw=candidate;source=url;break;}errors.push(url+": Reddit JSON schema unavailable");}catch(error){errors.push(url+": "+String(error));}}
 if(!raw){return{value:{mentions:null,mentionChangePct:null,toneScore:null,concentrationTop5Pct:null,attentionSpike:null,temperature:"UNAVAILABLE",label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:null},provenance:[unavailableProvenance("social.reddit",REDDIT+" + "+REDDIT_FALLBACK,at,errors.join("; "))]};}
 const items=raw.data.children as any[],value=build(items,at),p:ContextProvenance[]=[provenance("social.reddit",source,at,raw)];
 if(process.env.X_BEARER_TOKEN){try{const xr=await fetch(X_SEARCH,{headers:{accept:"application/json",authorization:"Bearer "+process.env.X_BEARER_TOKEN},signal:AbortSignal.timeout(8000)});if(!xr.ok)throw new Error("X HTTP "+xr.status);const xv=await xr.json();p.push(provenance("social.x",X_SEARCH,at,xv));}catch(e){p.push(unavailableProvenance("social.x",X_SEARCH,at,String(e)));}}
 else p.push(unavailableProvenance("social.x",X_SEARCH,at,"X_BEARER_TOKEN not configured"));
 return{value,provenance:p};
}