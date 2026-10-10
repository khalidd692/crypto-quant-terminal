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
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.X_BEARER_TOKEN;
  else process.env.X_BEARER_TOKEN = originalToken;
}
console.log("Social fallback tests passed.");
