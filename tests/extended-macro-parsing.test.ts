import assert from "node:assert/strict";
import { fetchExtendedMacro } from "../src/context/providers/extended.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("id=DTWEXBGS")) {
    return new Response("observation_date,DTWEXBGS\n2026-10-08,101.2\n2026-10-09,\n2026-10-10,.\n", { status: 200 });
  }
  if (url.includes("id=SP500")) {
    return new Response("observation_date,SP500\n2026-10-09,\n2026-10-10,.\n", { status: 200 });
  }
  return new Response("observation_date,value\n2026-10-09,4.2\n", { status: 200 });
};
try {
  const result = await fetchExtendedMacro("2026-10-10T20:00:00.000Z");
  assert.deepEqual(result.series.DTWEXBGS?.map(point => point.value), [101.2]);
  assert.equal(result.series.SP500?.length, 0, "blank observations must not become zero");
  assert.equal(result.provenance.find(item => item.field === "macroSeries.DTWEXBGS")?.status, "OK");
  assert.equal(result.provenance.find(item => item.field === "macroSeries.SP500")?.status, "UNAVAILABLE",
    "a CSV with no valid observations must not be reported as available");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Extended macro parsing tests passed.");