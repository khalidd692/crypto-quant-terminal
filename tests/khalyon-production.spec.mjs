import {test,expect} from "@playwright/test";
import {mkdir} from "node:fs/promises";
const base=process.env.KHALYON_PUBLIC_URL, expected=process.env.EXPECTED_SHA;

// After hydration, "Données: UNAVAILABLE" is a legitimate fail-closed result
// for stale/missing runtime data. Only the literal provisional UTC placeholders fail.
function assertHydratedFreshnessHeader(header) {
  expect(header).not.toContain("Build: UNAVAILABLE UTC");
  expect(header).not.toContain("Données: UNAVAILABLE UTC");
}

test("freshness assertion accepts a legitimate unavailable-data status",()=>{
  expect(()=>assertHydratedFreshnessHeader("Build: 2026-10-11 20:00 UTC · Données: UNAVAILABLE")).not.toThrow();
});
test("freshness assertion rejects the provisional pre-hydration UTC placeholders",()=>{
  expect(()=>assertHydratedFreshnessHeader("Build: UNAVAILABLE UTC · Données: UNAVAILABLE UTC")).toThrow();
});

test("deployed public page is hydrated and public manifest matches the exact workflow SHA",async({page,request})=>{
  expect(base,"KHALYON_PUBLIC_URL is required").toBeTruthy();expect(expected,"EXPECTED_SHA is required").toMatch(/^[0-9a-f]{40}$/);
  const manifestResponse=await request.get(new URL("build-manifest.json",base).toString(),{timeout:30000});
  expect(manifestResponse.ok(),"public build manifest must be reachable").toBeTruthy();
  const manifest=await manifestResponse.json();expect(manifest.sourceCommit).toBe(expected);expect(manifest.workflowRunId).toBeTruthy();expect(Number.isFinite(Date.parse(manifest.builtAt))).toBeTruthy();
  await page.goto(base,{waitUntil:"networkidle",timeout:60000});
  await expect(page.locator("#freshness")).toHaveAttribute("data-hydrated","true",{timeout:30000});
  const header=await page.locator("#freshness").innerText();
  assertHydratedFreshnessHeader(header);
  await expect(page.locator("#app")).not.toContainText(/\\bundefined\\b|\\bNaN\\b/i);
  await mkdir("artifacts",{recursive:true});await page.screenshot({path:"artifacts/khalyon-production-public.png",fullPage:true});
});
