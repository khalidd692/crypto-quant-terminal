import { fetchText } from "./http.js";
import { numberOrNull, provenance, unavailableProvenance } from "./common.js";
import type { ContextProvenance, MacroContext } from "../types.js";

const DAILY_WINDOW_DAYS = 15;
const CPI_WINDOW_DAYS = 460;

function fredUrl(id: string, at: string, days: number): string {
  const end = new Date(at);
  if (!Number.isFinite(end.getTime())) throw new Error("INVALID_MACRO_AS_OF");
  const start = new Date(end.getTime() - days * 86_400_000);
  const url = new URL("https://fred.stlouisfed.org/graph/fredgraph.csv");
  url.searchParams.set("id", id);
  url.searchParams.set("cosd", start.toISOString().slice(0, 10));
  url.searchParams.set("coed", end.toISOString().slice(0, 10));
  return url.toString();
}

const SERIES = {
  DFF: { url: (at: string) => fredUrl("DFF", at, DAILY_WINDOW_DAYS) },
  DGS10: { url: (at: string) => fredUrl("DGS10", at, DAILY_WINDOW_DAYS) },
  DTWEXBGS: { url: (at: string) => fredUrl("DTWEXBGS", at, DAILY_WINDOW_DAYS) },
  CPIAUCSL: { url: (at: string) => fredUrl("CPIAUCSL", at, CPI_WINDOW_DAYS) },
} as const;

function parse(raw: string): { latest: number | null; values: number[] } {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("FRED_CSV_UNAVAILABLE");
  const values = lines.slice(1).flatMap(line => {
    const [date, rawValue] = line.split(",");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const observedAt = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(observedAt.getTime())) return [];
    const field = rawValue?.trim();
    if (!field || field === ".") return [];
    const value = Number(field);
    return Number.isFinite(value) ? [value] : [];
  });
  if (values.length === 0) throw new Error("FRED_CSV_NO_VALID_NUMERIC_OBSERVATIONS");
  return { latest: values.at(-1) ?? null, values };
}

export async function fetchMacroContext(at: string): Promise<{
  value: MacroContext;
  provenance: ContextProvenance[];
}> {
  const entries = await Promise.all(Object.entries(SERIES).map(async ([name, config]) => {
    const url = config.url(at);
    try {
      const raw = await fetchText(url);
      const parsed = parse(raw);
      return [name, parsed, provenance("macro." + name, url, at, raw)] as const;
    } catch (error) {
      return [name, { latest: null, values: [] }, unavailableProvenance("macro." + name, url, at, String(error))] as const;
    }
  }));

  const get = (name: string) => entries.find(entry => entry[0] === name)!;
  const dff = get("DFF"), dgs = get("DGS10"), usd = get("DTWEXBGS"), cpi = get("CPIAUCSL");
  const d = dff[1].values, u = usd[1].values, c = cpi[1].values;
  const dailyRateDelta = d.length > 1 ? d.at(-1)! - d.at(-2)! : null;
  const dollarDelta = u.length > 1 ? u.at(-1)! - u.at(-2)! : null;
  const currentCpi = c.at(-1), previousYearCpi = c.length >= 13 ? c.at(-13) : undefined;
  const cpiYoYPct = currentCpi !== undefined && previousYearCpi !== undefined && previousYearCpi !== 0
    ? (currentCpi / previousYearCpi - 1) * 100
    : null;

  return {
    value: {
      ratesBias: dailyRateDelta === null ? "UNKNOWN" : dailyRateDelta < -0.001 ? "EASING" : dailyRateDelta > 0.001 ? "TIGHTENING" : "NEUTRAL",
      inflationBias: cpiYoYPct === null ? "UNKNOWN" : cpiYoYPct < 2 ? "DISINFLATION" : cpiYoYPct > 3 ? "INFLATIONARY" : "NEUTRAL",
      dollarBias: dollarDelta === null ? "UNKNOWN" : dollarDelta < -0.001 ? "WEAKENING" : dollarDelta > 0.001 ? "STRENGTHENING" : "NEUTRAL",
      policyRatePct: numberOrNull(dff[1].latest),
      tenYearYieldPct: numberOrNull(dgs[1].latest),
      dollarIndex: numberOrNull(usd[1].latest),
      cpiYoYPct,
      sourceAsOf: at,
    },
    provenance: entries.map(entry => entry[2]),
  };
}
