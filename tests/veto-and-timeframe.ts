import { evaluateHardVetoes } from "../src/decision/veto.js";
import { detectTimeGaps } from "../src/domain/gaps.js";
import { assessMultiTimeframeAlignment } from "../src/setup/multitimeframe.js";

const veto = evaluateHardVetoes({
  dataValid: true,
  dataFresh: true,
  liquidityPassed: false,
  portfolioRiskAllowed: true,
  invalidationDefined: true,
});
if (!veto.vetoed || !veto.reasons.includes("liquidity_gate_failed")) throw new Error("Veto engine mismatch");

const base = {
  instrumentId: "TEST",
  eventTime: "2026-01-01T00:00:00Z" as any,
  availableTime: "2026-01-01T00:00:00Z" as any,
  open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, dataQuality: "complete" as const, sourceId: "fixture",
};
const later = { ...base, eventTime: "2026-01-01T02:00:00Z" as any };
if (detectTimeGaps([base, later], 60 * 60 * 1000).length !== 1) throw new Error("Gap detection mismatch");

const empty = assessMultiTimeframeAlignment([]);
if (empty.aligned || !empty.reasons.includes("missing_timeframe")) throw new Error("MTF alignment mismatch");
