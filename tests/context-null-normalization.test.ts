import assert from "node:assert/strict";
import { numberOrNull } from "../src/context/providers/common.js";
import { fetchMacroContext } from "../src/context/providers/macro.js";

assert.equal(numberOrNull(null), null);
assert.equal(numberOrNull(undefined), null);
assert.equal(numberOrNull(""), null);
assert.equal(numberOrNull("   "), null);
assert.equal(numberOrNull("."), null);
assert.equal(numberOrNull("0"), 0);
assert.equal(numberOrNull(0), 0);
assert.equal(numberOrNull("3.25"), 3.25);
assert.equal(numberOrNull(true), null);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("id=DFF")) return new Response("observation_date,DFF\n2026-10-08,4.1\n2026-10-09,.\n", { status: 200 });
  if (url.includes("id=DGS10")) return new Response("observation_date,DGS10\n2026-10-09,4.2\n", { status: 200 });
  if (url.includes("id=DTWEXBGS")) return new Response("observation_date,DTWEXBGS\n2026-10-08,101.2\n2026-10-09,\n", { status: 200 });
  if (url.includes("id=CPIAUCSL")) return new Response("observation_date,CPIAUCSL\n2025-10-01,300\n2026-10-01,306\n", { status: 200 });
  throw new Error("Unexpected URL: " + url);
};
try {
  const result = await fetchMacroContext("2026-10-10T19:30:00.000Z");
  assert.equal(result.value.policyRatePct, 4.1, "FRED dot/missing values must not become zero");
  assert.equal(result.value.dollarIndex, 101.2, "blank FRED fields must not become zero");
  assert.equal(result.value.ratesBias, "UNKNOWN", "one observation is not enough to infer rate direction");
  assert.equal(result.value.dollarBias, "UNKNOWN", "one observation is not enough to infer dollar direction");
  assert.equal(result.provenance.find(p => p.field === "macro.DFF")?.status, "OK");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Context null-normalization tests passed.");