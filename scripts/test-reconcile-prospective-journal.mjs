import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { appendProspectiveRecord, readProspectiveJournal } from "../dist/src/automation/journal.js";

const dir = mkdtempSync(join(tmpdir(), "journal-reconcile-test-"));
try {
  const before = join(dir, "before.jsonl");
  const after = join(dir, "after.jsonl");
  const latest = join(dir, "latest.jsonl");
  writeFileSync(before, "", "utf8");
  writeFileSync(after, "", "utf8");
  writeFileSync(latest, "", "utf8");

  const record = (assetId, snapshotHash) => ({
    schemaVersion: "prospective-journal.v1",
    recordedAt: "2026-10-09T12:00:00.000Z",
    assetId,
    decision: "ATTENDRE",
    reasons: ["fixture"],
    snapshotHash,
    mode: "TEST_SANS_ARGENT"
  });
  appendProspectiveRecord(before, record("BASE", "sha256:" + "a".repeat(64)));
  appendProspectiveRecord(after, record("BASE", "sha256:" + "a".repeat(64)));
  const baseline = readProspectiveJournal(after);
  appendProspectiveRecord(after, record("RUN", "sha256:" + "b".repeat(64)));
  appendProspectiveRecord(latest, record("BASE", "sha256:" + "a".repeat(64)));
  appendProspectiveRecord(latest, record("CONCURRENT", "sha256:" + "c".repeat(64)));

  const result = spawnSync(process.execPath, [
    "scripts/reconcile-prospective-journal.mjs", after, after, latest
  ], { encoding: "utf8" });
  // The after argument is deliberately not a valid baseline in this fixture; the helper must reject it.
  assert.notEqual(result.status, 0);

  writeFileSync(before, baseline.map(r => JSON.stringify(r)).join("\n") + "\n", "utf8");
  const corrected = spawnSync(process.execPath, [
    "scripts/reconcile-prospective-journal.mjs", before, after, latest
  ], { encoding: "utf8" });
  assert.equal(corrected.status, 0, corrected.stderr || corrected.stdout);
  const rows = readProspectiveJournal(latest);
  assert.deepEqual(rows.map(r => r.assetId), ["BASE", "CONCURRENT", "RUN"]);
  assert.equal(rows.length, 3);
  console.log("prospective journal concurrent reconciliation: PASS (hash chain preserved)");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
