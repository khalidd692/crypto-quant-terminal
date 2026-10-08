import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertFrozenFundingArchive, manifestSha256, type FrozenFundingManifest, EXPECTED_FROZEN_FUNDING_ARCHIVE_SHA256 } from "../src/research/frozen-funding.js";

const dir = join(process.cwd(), "dist", "test-frozen-funding-fixture");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const zipName = "BTCUSDT-fundingRate-2025-01.zip";
const zipBytes = Buffer.from("immutable-fixture");
const fileHash = createHash("sha256").update(zipBytes).digest("hex");
writeFileSync(join(dir, zipName), zipBytes);
const base = {
  schemaVersion: "funding-archive.v1",
  source: "Binance Vision USDⓈ-M Futures monthly fundingRate",
  symbol: "BTCUSDT",
  periodStart: "2020-01",
  periodEndExclusive: "2026-01",
  files: [{ filename: zipName, source: "https://data.binance.vision/frozen-fixture", period: "2025-01", rows: 3, sha256: fileHash }],
};
const baseManifest = base as unknown as FrozenFundingManifest;
const manifest = { ...baseManifest, archiveSha256: manifestSha256(baseManifest) };
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
let failed = false;
try { assertFrozenFundingArchive(dir); } catch { failed = true; }
if (!failed) throw new Error("Fixture with a non-canonical archive hash must fail closed");
if (EXPECTED_FROZEN_FUNDING_ARCHIVE_SHA256 === manifest.archiveSha256) throw new Error("Fixture unexpectedly matches frozen archive lock");
const tamperedManifest = { ...manifest, archiveSha256: EXPECTED_FROZEN_FUNDING_ARCHIVE_SHA256 };
writeFileSync(join(dir, "manifest.json"), JSON.stringify(tamperedManifest, null, 2) + "\n");
failed = false;
try { assertFrozenFundingArchive(dir); } catch { failed = true; }
if (!failed) throw new Error("Fixture with a forged expected archive hash must fail closed");
rmSync(dir, { recursive: true, force: true });
