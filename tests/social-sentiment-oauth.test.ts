import assert from "node:assert/strict";
import { fetchSocialSentiment } from "../src/context/providers/social.js";
const originalFetch=globalThis.fetch, oldId=process.env.REDDIT_CLIENT_ID, oldSecret=process.env.REDDIT_CLIENT_SECRET, oldX=process.env.X_BEARER_TOKEN;
const at="2026-10-11T20:00:00.000Z";
try {
  process.env.REDDIT_CLIENT_ID="fixture-id"; process.env.REDDIT_CLIENT_SECRET="fixture-secret"; delete process.env.X_BEARER_TOKEN;
  let tokenCalls=0, searchCalls=0;
  globalThis.fetch=async(input,init)=>{const url=String(input);if(url.includes("access_token")){tokenCalls++;assert.equal(init?.method,"POST");assert.match(String(new Headers(init?.headers).get("authorization")),/^Basic /);return new Response(JSON.stringify({access_token:"fixture-access",token_type:"bearer"}),{status:200});}if(url.includes("oauth.reddit.com")){searchCalls++;assert.equal(new Headers(init?.headers).get("authorization"),"Bearer fixture-access");return new Response(JSON.stringify({data:{children:[{data:{title:"TEL bullish adoption",author:"fixture-user"}},{data:{title:"TEL partnership growth",author:"other-user"}}]}}),{status:200});}throw new Error("Unexpected URL");};
  const ok=await fetchSocialSentiment(at);assert.equal(tokenCalls,1);assert.equal(searchCalls,1);assert.equal(ok.value.mentions,2);assert.equal(ok.provenance.find(p=>p.field==="social.reddit")?.status,"OK");
  globalThis.fetch=async()=>new Response("blocked",{status:403});
  const forbidden=await fetchSocialSentiment(at);assert.equal(forbidden.value.temperature,"UNAVAILABLE");assert.match(forbidden.provenance.find(p=>p.field==="social.reddit")?.reason??"",/403/);
  globalThis.fetch=async(input)=>{if(String(input).includes("access_token"))return new Response(JSON.stringify({access_token:"x"}),{status:200});return new Response("rate limited",{status:429});};
  const rate=await fetchSocialSentiment(at);assert.equal(rate.value.temperature,"UNAVAILABLE");assert.match(rate.provenance.find(p=>p.field==="social.reddit")?.reason??"",/429/);
  globalThis.fetch=async()=>{throw new Error("upstream diagnostic echoed fixture-id and fixture-secret");};
  const leaked=await fetchSocialSentiment(at);
  const safeReason=leaked.provenance.find(p=>p.field==="social.reddit")?.reason??"";
  assert.equal(leaked.value.temperature,"UNAVAILABLE");
  assert.ok(!safeReason.includes("fixture-id"),"client ID must never appear in error provenance");
  assert.ok(!safeReason.includes("fixture-secret"),"client secret must never appear in error provenance");
  assert.ok(safeReason.includes("[REDACTED]"),"credential redaction should be explicit");
  delete process.env.REDDIT_CLIENT_ID;delete process.env.REDDIT_CLIENT_SECRET;globalThis.fetch=async()=>{throw new Error("must not call without secrets");};
  const missing=await fetchSocialSentiment(at);assert.equal(missing.value.temperature,"UNAVAILABLE");assert.equal(missing.provenance.find(p=>p.field==="social.reddit")?.reason,"REDDIT_OAUTH_CREDENTIALS_MISSING");
} finally {globalThis.fetch=originalFetch; const restore=(key:string,value:string|undefined)=>{if(value===undefined)delete process.env[key];else process.env[key]=value;}; restore("REDDIT_CLIENT_ID",oldId);restore("REDDIT_CLIENT_SECRET",oldSecret);restore("X_BEARER_TOKEN",oldX);}
console.log("Reddit OAuth sentiment tests passed.");
