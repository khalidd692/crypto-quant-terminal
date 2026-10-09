import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { appendProspectiveRecord, readProspectiveJournal } from "../dist/src/automation/journal.js";

const [beforePath, afterPath, targetPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !targetPath) {
  throw new Error("Usage: reconcile-prospective-journal.mjs BEFORE AFTER TARGET");
}
for (const path of [beforePath, afterPath]) {
  if (!existsSync(path)) throw new Error("Missing journal snapshot: " + path);
}
if (!existsSync(targetPath)) writeFileSync(targetPath, "", "utf8");

const before = readProspectiveJournal(beforePath);
const after = readProspectiveJournal(afterPath);
const latest = readProspectiveJournal(targetPath);
const hashes = (rows) => rows.map((r) => r.recordHash);
const prefix = (prefixRows, rows) => {
  if (prefixRows.length > rows.length) return false;
  const a = hashes(prefixRows), b = hashes(rows);
  return a.every((hash, i) => b[i] === hash);
};
if (!prefix(before, after)) {
  throw new Error("Run journal is not an append-only extension of its baseline");
}
if (!prefix(before, latest)) {
  throw new Error("Remote journal diverged from the run baseline; refusing to rewrite the hash chain");
}
const additions = after.slice(before.length);
const key = (r) => JSON.stringify([
  r.recordedAt, r.assetId, r.snapshotHash, r.decision,
  r.mode ?? null, r.referenceRecordHash ?? null, r.horizonDays ?? null
]);
const existing = new Set(latest.map(key));
for (const record of additions) {
  if (existing.has(key(record))) continue;
  const { previousHash: _previousHash, recordHash: _recordHash, ...input } = record;
  appendProspectiveRecord(targetPath, input);
  existing.add(key(record));
}
const verified = readProspectiveJournal(targetPath);
console.log(JSON.stringify({
  baselineRecords: before.length,
  runRecords: additions.length,
  remoteRecordsBeforeMerge: latest.length,
  recordsAppended: verified.length - latest.length,
  recordsAfterMerge: verified.length,
  hashChainVerified: true
}));
