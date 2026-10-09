import assert from "node:assert/strict";
import { withProviderTimeout } from "../src/context/provider-guard.js";

type TestResult = { value?: number; status?: string; reason?: string };

const fast = await withProviderTimeout<TestResult>(
  "fast-provider",
  Promise.resolve({ value: 7 }),
  50,
  reason => ({ reason })
);
assert.deepEqual(fast, { value: 7 });

const slow = await withProviderTimeout<TestResult>(
  "slow-provider",
  new Promise<TestResult>(() => {}),
  5,
  reason => ({ reason })
);
assert.equal(slow.value, undefined);
assert.match(slow.reason ?? "", /slow-provider_TIMEOUT_AFTER_5MS/);

const independent = await Promise.all([
  withProviderTimeout<TestResult>("slow-provider", new Promise<TestResult>(() => {}), 5, reason => ({ status: "UNAVAILABLE", reason })),
  withProviderTimeout<TestResult>("healthy-provider", Promise.resolve({ status: "OK", value: 3 }), 50, reason => ({ status: "UNAVAILABLE", reason }))
]);
assert.equal(independent[0].status, "UNAVAILABLE");
assert.match(independent[0].reason ?? "", /slow-provider_TIMEOUT_AFTER_5MS/);
assert.deepEqual(independent[1], { status: "OK", value: 3 });
console.log("Context provider isolation tests passed");
