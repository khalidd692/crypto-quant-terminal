import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertFrozenFundingArchive, manifestSha256, type FrozenFundingManifest } from "../src/research/frozen-funding.js";

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
assertFrozenFundingArchive(dir);
writeFileSync(join(dir, zipName), Buffer.from("tampered-fixture"));
let failed = false;
try { assertFrozenFundingArchive(dir); } catch { failed = true; }
if (!failed) throw new Error("Altered funding archive must fail closed");
writeFileSync(join(dir, zipName), zipBytes);
assertFrozenFundingArchive(dir);
if (manifestSha256(manifest) !== manifest.archiveSha256) throw new Error("Funding manifest hash is not reproducible");
rmSync(dir, { recursive: true, force: true });
