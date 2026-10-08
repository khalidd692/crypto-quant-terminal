import { evaluateTelSurveillance, type VenueSnapshot, type TelSurveillanceConfig } from "../src/surveillance/tel-usdt.js";

const base = (venue: "KUCOIN" | "MEXC"): VenueSnapshot => ({
  venue, symbol: "TEL-USDT", eventTime: "2026-10-08T08:00:00.000Z", availableTime: "2026-10-08T08:00:00.000Z",
  lastPrice: 0.005, bid: 0.00499, ask: 0.00501, volume24hQuote: 100000, trendOk: true, volatilityOk: true, quality: "OK",
});
const config: TelSurveillanceConfig = {
  maxAgeMs: 60_000, maxCrossVenueDeviationBps: 100, entryZone: { lower: 0.0049, upper: 0.0051 },
  invalidationPrice: 0.004, target1: 0.007, target2: 0.008, maxLossQuote: 100, existingPosition: "NONE", exitTriggered: false,
};
const now = Date.parse("2026-10-08T08:00:30.000Z");

const enter = evaluateTelSurveillance(base("KUCOIN"), base("MEXC"), config, now);
if (enter.decision !== "ENTRER") throw new Error("Expected ENTRER");
if (!enter.banner.includes("PAS D'EDGE")) throw new Error("Missing surveillance banner");
if (enter.conditions.dataFresh !== true || enter.conditions.crossVenueOk !== true || enter.conditions.inEntryZone !== true || enter.conditions.trendOk !== true || enter.conditions.volatilityOk !== true || enter.conditions.sizingValid !== true || enter.conditions.degraded !== false || Number(enter.conditions.rr) < 2) throw new Error("ENTRER condition set is inconsistent");

const wait = evaluateTelSurveillance(base("KUCOIN"), base("MEXC"), { ...config, entryZone: { lower: 0.0052, upper: 0.0053 } }, now);
if (wait.decision !== "ATTENDRE") throw new Error("Expected ATTENDRE");

const exit = evaluateTelSurveillance(base("KUCOIN"), base("MEXC"), { ...config, existingPosition: "LONG", exitTriggered: true }, now);
if (exit.decision !== "SORTIR") throw new Error("Expected SORTIR");

const invalid = evaluateTelSurveillance(base("KUCOIN"), base("MEXC"), { ...config, maxLossQuote: 0 }, now);
if (invalid.decision !== "NE_PAS_ENTRER") throw new Error("Expected NE_PAS_ENTRER for invalid risk config");

const noPrimary = evaluateTelSurveillance(null, base("MEXC"), config, now);
if (!["ATTENDRE", "NE_PAS_ENTRER"].includes(noPrimary.decision)) throw new Error("Unavailable primary must never ENTRER");

const stale = evaluateTelSurveillance({ ...base("KUCOIN"), availableTime: "2026-10-08T07:50:00.000Z" }, base("MEXC"), config, now);
if (!["ATTENDRE", "NE_PAS_ENTRER"].includes(stale.decision)) throw new Error("Stale primary must never ENTRER");

const mismatch = evaluateTelSurveillance(base("KUCOIN"), { ...base("MEXC"), lastPrice: 0.0052 }, config, now);
if (!["ATTENDRE", "NE_PAS_ENTRER"].includes(mismatch.decision)) throw new Error("Cross-venue mismatch must never ENTRER");
if (!mismatch.reasons.some(r => r.includes("Écart KuCoin/MEXC"))) throw new Error("Mismatch reason missing");

const noSecondary = evaluateTelSurveillance(base("KUCOIN"), null, config, now);
if (!["ATTENDRE", "NE_PAS_ENTRER"].includes(noSecondary.decision)) throw new Error("Missing MEXC cross-check must never ENTRER");

const staleSecondary = evaluateTelSurveillance(base("KUCOIN"), { ...base("MEXC"), quality: "STALE" }, config, now);
if (staleSecondary.decision === "ENTRER") throw new Error("Stale MEXC must never ENTRER");

const invalidVol = evaluateTelSurveillance(base("KUCOIN"), base("MEXC"), { ...config }, now);
if (invalidVol.decision !== "ENTRER") throw new Error("Baseline should remain ENTRER");
