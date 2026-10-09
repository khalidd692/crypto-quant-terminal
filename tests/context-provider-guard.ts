import assert from "node:assert/strict";
import { withProviderTimeout } from "../src/context/provider-guard.js";

const fast = await withProviderTimeout("fast-provider", Promise.resolve({ value: 7 }), 50, reason => ({ reason }));
assert.deepEqual(fast, { value: 7 });

const slow = await withProviderTimeout("slow-provider", new Promise<{ value: number }>(() => {}), 5, reason => ({ reason }));
assert.equal("reason" in slow, true);
assert.match((slow as { reason: string }).reason, /slow-provider_TIMEOUT_AFTER_5MS/);

const independent = await Promise.all([
  withProviderTimeout("slow-provider", new Promise<{ value: number }>(() => {}), 5, reason => ({ status: "UNAVAILABLE", reason })),
  withProviderTimeout("healthy-provider", Promise.resolve({ status: "OK", value: 3 }), 50, reason => ({ status: "UNAVAILABLE", reason }))
]);
assert.deepEqual(independent[0], { status: "UNAVAILABLE", reason: "Error: slow-provider_TIMEOUT_AFTER_5MS" });
assert.deepEqual(independent[1], { status: "OK", value: 3 });
console.log("Context provider isolation tests passed");
