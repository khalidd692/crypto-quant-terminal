import { fetchText } from "./http.js";
import { rawHash, unavailableProvenance, provenance } from "./common.js";
import type { ContextProvenance, ExternalSeriesPoint } from "../types.js";

const SERIES: Readonly<Record<string, string>> = {
  DTWEXBGS: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXBGS",
  SP500: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500",
  DGS10: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10",
  GOLDPMGBD228NLBM: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDPMGBD228NLBM",
  M2SL: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL"
};

function parse(raw: string, source: string): readonly ExternalSeriesPoint[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("FRED CSV unavailable");
  const snapshotHash = rawHash(raw);
  const out: ExternalSeriesPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, rawValue] = line.split(",");
    const field = rawValue?.trim();
    if (!date || !field || field === ".") continue;
    const value = Number(field);
    if (!Number.isFinite(value)) continue;
    const observedAt = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(observedAt.getTime())) continue;
    out.push({ observedAt: observedAt.toISOString(), value, source, sourceSnapshotHash: snapshotHash });
  }
  if (out.length === 0) throw new Error("FRED CSV contains no valid numeric observations");
  return out;
}

export async function fetchExtendedMacro(at: string): Promise<{
  series: Readonly<Record<string, readonly ExternalSeriesPoint[]>>;
  provenance: ContextProvenance[];
}> {
  const entries = await Promise.all(Object.entries(SERIES).map(async ([name, url]) => {
    try {
      const raw = await fetchText(url);
      const points = parse(raw, url);
      return [name, points, provenance("macroSeries." + name, url, at, raw)] as const;
    } catch (error) {
      return [name, [], unavailableProvenance("macroSeries." + name, url, at, String(error))] as const;
    }
  }));
  const series: Record<string, readonly ExternalSeriesPoint[]> = {};
  const resultProvenance: ContextProvenance[] = [];
  for (const [name, points, prov] of entries) {
    series[name] = points;
    resultProvenance.push(prov);
  }
  return { series, provenance: resultProvenance };
}
