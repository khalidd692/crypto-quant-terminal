import assert from "node:assert/strict";
import { fetchSocialSentiment } from "../src/context/providers/social.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.X_BEARER_TOKEN;
process.env.X_BEARER_TOKEN = "test-token";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("reddit.com")) return new Response("forbidden", { status: 403 });
  if (url.includes("api.x.com")) {
    return new Response(JSON.stringify({
      data: [
        { text: "Telcoin partnership adoption", author_id: "author-a" },
        { text: "TEL bullish growth", author_id: "author-b" }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("Unexpected URL: " + url);
};
try {
  const result = await fetchSocialSentiment("2026-10-10T20:00:00.000Z");
  assert.equal(result.value.mentions, 2, "X data must remain usable when Reddit is blocked");
  assert.ok((result.value.toneScore ?? 0) > 0);
  assert.equal(result.provenance.find(item => item.field === "social.reddit")?.status, "UNAVAILABLE");
  assert.equal(result.provenance.find(item => item.field === "social.x")?.status, "OK");

  // When Reddit is blocked and no X credential exists, neither source may be
  // represented as valid and the provider must return an explicit unavailable value.
  delete process.env.X_BEARER_TOKEN;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("reddit.com")) return new Response("forbidden", { status: 403 });
    if (url.includes("api.x.com")) throw new Error("X must not be requested without X_BEARER_TOKEN");
    if (url.includes("public.api.bsky.app")) {
      return new Response(JSON.stringify({ posts: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected URL: " + url);
  };
  const noCredentials = await fetchSocialSentiment("2026-10-10T20:01:00.000Z");
  assert.equal(noCredentials.value.mentions, null);
  assert.equal(noCredentials.value.toneScore, null);
  assert.equal(noCredentials.value.temperature, "UNAVAILABLE");
  assert.equal(noCredentials.provenance.find(item => item.field === "social.reddit")?.status, "UNAVAILABLE");
  assert.equal(noCredentials.provenance.find(item => item.field === "social.x")?.status, "UNAVAILABLE");
  assert.equal(noCredentials.provenance.find(item => item.field === "social.bluesky")?.status, "UNAVAILABLE",
    "empty Bluesky results must remain unavailable rather than being treated as neutral sentiment");

  // Bluesky public search can provide a real fallback without an X API token.
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("reddit.com")) return new Response("forbidden", { status: 403 });
    if (url.includes("api.x.com")) throw new Error("X must not be requested without X_BEARER_TOKEN");
    if (url.includes("public.api.bsky.app")) {
      return new Response(JSON.stringify({
        posts: [
          { record: { text: "Telcoin partnership adoption" }, author: { did: "did:plc:a" } },
          { record: { text: "TEL bullish growth" }, author: { did: "did:plc:b" } }
        ]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected URL: " + url);
  };
  const blueskyFallback = await fetchSocialSentiment("2026-10-10T20:02:00.000Z");
  assert.equal(blueskyFallback.value.mentions, 2);
  assert.notEqual(blueskyFallback.value.temperature, "UNAVAILABLE");
  assert.equal(blueskyFallback.provenance.find(item => item.field === "social.reddit")?.status, "UNAVAILABLE");
  assert.equal(blueskyFallback.provenance.find(item => item.field === "social.x")?.status, "UNAVAILABLE");
  assert.equal(blueskyFallback.provenance.find(item => item.field === "social.bluesky")?.status, "OK");
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.X_BEARER_TOKEN;
  else process.env.X_BEARER_TOKEN = originalToken;
}
console.log("Social fallback tests passed.");
