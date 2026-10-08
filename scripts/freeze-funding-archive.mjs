import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const symbol = "BTCUSDT";
const start = new Date(Date.UTC(2020, 0, 1));
const end = new Date(Date.UTC(2026, 0, 1));
const baseUrl = "https://data.binance.vision/data/futures/um/monthly/fundingRate/" + symbol + "/";
const outDir = process.env.FUNDING_ARCHIVE_DIR ?? "research/funding/frozen-btcusdt-2020-2025";
mkdirSync(outDir, { recursive: true });
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const monthKeys = () => {
  const out = []; const cursor = new Date(start);
  while (cursor < end) { out.push(cursor.toISOString().slice(0, 7)); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
  return out;
};
const countRows = bytes => {
  const archive = unzipSync(bytes);
  const csv = Object.entries(archive).find(([name]) => name.toLowerCase().endsWith(".csv"))?.[1];
  if (!csv) throw new Error("Archive has no CSV");
  return strFromU8(csv).split("\n").map(line => line.trim()).filter(Boolean)
    .filter(line => !/^calc_time,/.test(line) && !/^fundingTime,/.test(line)).length;
};
const files = [];
for (const period of monthKeys()) {
  const filename = symbol + "-fundingRate-" + period + ".zip";
  const url = baseUrl + filename;
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const checksumResponse = await fetch(url + ".CHECKSUM");
  if (!checksumResponse.ok) throw new Error("HTTP " + checksumResponse.status + " for checksum " + filename);
  const publishedHash = (await checksumResponse.text()).trim().split(/\s+/)[0];
  const actualHash = sha256(bytes);
  if (publishedHash !== actualHash) throw new Error("Binance CHECKSUM mismatch for " + filename);
  writeFileSync(join(outDir, filename), bytes);
  files.push({ filename, source: url, period, rows: countRows(bytes), sha256: actualHash });
}
const body = { schemaVersion: "funding-archive.v1", source: "Binance Vision USDⓈ-M Futures monthly fundingRate", symbol, periodStart: "2020-01", periodEndExclusive: "2026-01", files };
const archiveSha256 = sha256(Buffer.from(JSON.stringify(body), "utf8"));
writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ ...body, archiveSha256 }, null, 2) + "\n");
console.log(JSON.stringify({ outDir, files: files.length, rows: files.reduce((n, f) => n + f.rows, 0), archiveSha256 }, null, 2));
