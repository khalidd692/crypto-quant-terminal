import { buildResearchReport } from "../src/research/report.js";
import type { ResearchObservation } from "../src/research/observation-ledger.js";

const base = (side: "LONG" | "SHORT", r: number, targetHit: boolean, invalidationHit: boolean): ResearchObservation => ({
  observationId: `obs_${side}_${r}`,
  instrumentId: "TEST",
  eventTime: new Date(Date.UTC(2026, 0, 1, Math.abs(Math.round(r * 10)))).toISOString(),
  availableTime: new Date(Date.UTC(2026, 0, 1, Math.abs(Math.round(r * 10)))).toISOString(),
  datasetVersion: "sha256:test",
  featureDefinitionVersions: ["trend@1"],
  featureVersionPolicy: "core-v1",
  featureSnapshot: [],
  setupId: "baseline.trend.v1",
  side,
  entryReferencePrice: 100,
  horizonCandles: 8,
  horizonEndTime: null,
  targetR: 1.5,
  invalidationR: 1,
  outcome: {
    label: targetHit ? "TARGET" : invalidationHit ? "INVALIDATION" : "TIME_EXIT",
    targetHit,
    invalidationHit,
    timeExit: !targetHit && !invalidationHit,
    intrabarAmbiguous: false,
    mfeR: Math.max(0, r + 0.2),
    maeR: Math.min(0, r - 0.2),
    realizedR: r,
    returnFraction: r * 0.01,
    exitPrice: 100,
    exitEventTime: new Date(Date.UTC(2026, 0, 1, 9)).toISOString(),
    feesReturn: 0,
    slippageReturn: 0,
    fundingReturn: 0,
  },
  eligible: true,
  exclusionReason: null,
});

const observations = [
  base("LONG", 1, true, false),
  base("LONG", -1, false, true),
  base("SHORT", 0.5, true, false),
  base("SHORT", -0.5, false, true),
];
const report = buildResearchReport(observations);
if (report.cleanEligibleObservations !== 4) throw new Error("Clean count mismatch");
if (report.long.count !== 2 || report.short.count !== 2) throw new Error("Side counts mismatch");
if (report.all.mean !== 0) throw new Error("Mean R mismatch");
if (!report.targetHitRate || report.targetHitRate.probability !== 0.5) throw new Error("Target probability mismatch");
