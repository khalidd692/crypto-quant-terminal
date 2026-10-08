import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const EXPECTED_FROZEN_FUNDING_ARCHIVE_SHA256 =
  "137d7f4f0d41fbdae1b93d9aa3b50cf3193e91630eb46fc09262d8a53fbeaf8a";

export interface FrozenFundingFile {
  readonly filename: string;
  readonly source: string;
  readonly period: string;
  readonly rows: number;
  readonly sha256: string;
}
export interface FrozenFundingManifest {
  readonly schemaVersion: "funding-archive.v1";
  readonly source: "Binance Vision USDⓈ-M Futures monthly fundingRate";
  readonly symbol: "BTCUSDT";
  readonly periodStart: "2020-01";
  readonly periodEndExclusive: "2026-01";
  readonly files: readonly FrozenFundingFile[];
  readonly archiveSha256: string;
}
function sha256(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalManifestBody(manifest: FrozenFundingManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion, source: manifest.source, symbol: manifest.symbol,
    periodStart: manifest.periodStart, periodEndExclusive: manifest.periodEndExclusive,
    files: manifest.files.map(({ filename, source, period, rows, sha256 }) => ({ filename, source, period, rows, sha256 })),
  });
}
export function manifestSha256(manifest: FrozenFundingManifest): string { return sha256(Buffer.from(canonicalManifestBody(manifest), "utf8")); }
export function loadFrozenFundingManifest(dir: string): FrozenFundingManifest {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as FrozenFundingManifest;
  if (manifest.schemaVersion !== "funding-archive.v1") throw new Error("Unsupported funding archive manifest schema");
  if (manifest.symbol !== "BTCUSDT") throw new Error("Frozen funding archive symbol mismatch");
  if (manifest.periodStart !== "2020-01" || manifest.periodEndExclusive !== "2026-01") throw new Error("Frozen funding archive period mismatch");
  if (manifest.archiveSha256 !== manifestSha256(manifest)) throw new Error("Frozen funding manifest hash mismatch");
  if (manifest.archiveSha256 !== EXPECTED_FROZEN_FUNDING_ARCHIVE_SHA256) {
    throw new Error("Frozen funding archive version/hash mismatch");
  }
  return manifest;
}
export function verifyFrozenFundingArchive(dir: string): FrozenFundingManifest {
  const manifest = loadFrozenFundingManifest(dir);
  const actualNames = new Set(readdirSync(dir));
  for (const file of manifest.files) {
    if (!actualNames.has(file.filename)) throw new Error("Frozen funding archive file missing: " + file.filename);
    const actual = sha256(readFileSync(join(dir, file.filename)));
    if (actual !== file.sha256) throw new Error("Frozen funding archive hash mismatch for " + file.filename + ": expected " + file.sha256 + ", got " + actual);
  }
  return manifest;
}
export function assertFrozenFundingArchive(dir: string): void { verifyFrozenFundingArchive(dir); }
