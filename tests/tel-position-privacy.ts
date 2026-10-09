import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderPrivateTelPositionReport } from "../src/surveillance/tel-position-private.js";

const report = renderPrivateTelPositionReport({
  asOf: "2026-10-09T00:00:00.000Z",
  averageEntryPrice: 0.002,
  quantity: 1000,
  currentPrice: 0.0018,
  invalidationPrice: 0.0015,
  target1: 0.0025,
  target2: 0.003,
  roundTripFeePct: 0.003,
  slippagePct: 0.005
});
assert.ok(report.includes("Position TEL — rapport privé"));
assert.ok(report.includes("P&amp;L net estimé"));
assert.ok(report.includes("Invalidation configurée"));
assert.ok(report.includes("Objectif 1 configuré"));
assert.ok(report.includes("Objectif 2 configuré"));

const runner = readFileSync("src/automation/runner.ts", "utf8");
const pages = readFileSync(".github/workflows/prospective-surveillance.yml", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
assert.ok(runner.includes("TEL_POSITION_AVG_PRICE"));
assert.ok(runner.includes("TEL_POSITION_QUANTITY"));
assert.ok(runner.includes('mode:0o600'));
assert.ok(!pages.includes("path: public-decision"));assert.ok(!pages.includes("actions/upload-pages-artifact@v4"));assert.ok(!pages.includes("actions/deploy-pages@v4"));
assert.ok(!pages.includes("tel-position-private.html"));
assert.ok(!ci.includes("tel-position-private.html"));
assert.ok(!runner.includes("git add artifacts"));
console.log("TEL position privacy: PASS (private report only; no position values in journal or public artifacts)");
