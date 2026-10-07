import type { ResearchObservation } from "./observation-ledger.js";
import { estimateDependenceAdjustedBinomial } from "../statistics/dependence-adjustment.js";
import { movingBlockBootstrapMean, type MeanBootstrapInterval } from "../statistics/bootstrap.js";
import { estimateConditionalProbability, type EmpiricalProbabilityEstimate } from "../statistics/empirical-probability.js";
import { BASELINE_SETUP_ID } from "../setup/basic.js";
import { buildBaselines, type BaselineSummary } from "./baselines.js";
import { buildResearchReport, type ResearchReport } from "./report.js";
import type { MarketDataPoint } from "../domain/types.js";
import type { BinanceFundingRate } from "../adapters/binance/public-client.js";

export interface Phase3Criteria {
  readonly wilsonAdjustedLower: number | null;
  readonly breakEvenProbability: number | null;
  readonly criterion1Pass: boolean;
  readonly bootstrapLower95At15x: number | null;
  readonly criterion2Pass: boolean;
  readonly setupMeanRealizedR: number | null;
  readonly random95MeanR: number | null;
  readonly criterion3Pass: boolean;
  readonly verdict: "EDGE" | "PAS D'EDGE";
}

export interface Phase3PartitionReport {
  readonly partition: "validation" | "test";
  readonly report: ResearchReport;
  readonly criteria: Phase3Criteria;
  readonly baselines: readonly BaselineSummary[];
  readonly modelBySide: readonly EmpiricalProbabilityEstimate[];
}

function breakEvenProbability(observations: readonly ResearchObservation[]): number | null {
  const usable = observations.filter((o) =>
    o.eligible && o.outcome !== null && !o.outcome.intrabarAmbiguous &&
    !o.outcome.timeExit && (o.outcome.targetHit || o.outcome.invalidationHit)
  );
  const costsR: number[] = [];
  for (const o of usable) {
    const atrRatio = o.featureSnapshot.find((f) => f.featureId === "volatility.atr_ratio")?.value;
    if (atrRatio === undefined || atrRatio === null || !Number.isFinite(atrRatio) || atrRatio <= 0) continue;
    const riskFraction = atrRatio * (o.invalidationR ?? 0);
    if (!(riskFraction > 0)) continue;
    const costR = -((o.outcome!.feesReturn + o.outcome!.slippageReturn) / riskFraction);
    if (Number.isFinite(costR)) costsR.push(costR);
  }
  if (!costsR.length) return null;
  const meanCostR = costsR.reduce((a, b) => a + b, 0) / costsR.length;
  return (1 + meanCostR) / ((oTarget(observations) ?? 1.5) + (oInvalidation(observations) ?? 1));
}

function oTarget(observations: readonly ResearchObservation[]): number | null {
  return observations.find((o) => o.targetR !== null)?.targetR ?? null;
}
function oInvalidation(observations: readonly ResearchObservation[]): number | null {
  return observations.find((o) => o.invalidationR !== null)?.invalidationR ?? null;
}

export function buildPhase3PartitionReport(
  partition: "validation" | "test",
  observations: readonly ResearchObservation[],
  allPoints: readonly MarketDataPoint[],
  fundingRates: readonly BinanceFundingRate[],
  trainEnd: string,
  costs: { readonly feeRate: number; readonly slippageRate: number },
): Phase3PartitionReport {
  const report = buildResearchReport(observations, { blockSize: 8, bootstrapResamples: 2000, confidenceLevel: 0.95, bootstrapSeed: 20261007 });
  const adjusted = estimateDependenceAdjustedBinomial(
    observations.filter((o) => o.eligible && o.outcome !== null && !o.outcome.intrabarAmbiguous && !o.outcome.timeExit),
    (o) => o.outcome!.targetHit,
  );
  const models = (["LONG", "SHORT"] as const)
    .map((side) => estimateConditionalProbability(observations, { setupId: BASELINE_SETUP_ID, side }, trainEnd))
    .filter((value): value is EmpiricalProbabilityEstimate => value !== null);
  const baselines = buildBaselines(observations, allPoints, fundingRates, costs, 20261007, 1000);
  const random95 = baselines.find((b) => b.name === "RANDOM_ENTRY")?.randomDistribution?.percentile95MeanR ?? null;
  const setupMean = report.all.mean;
  return {
    partition,
    report,
    criteria: {
      wilsonAdjustedLower: adjusted?.adjusted.interval.lower ?? null,
      breakEvenProbability: breakEvenProbability(observations),
      criterion1Pass: adjusted !== null && breakEvenProbability(observations) !== null && adjusted.adjusted.interval.lower > breakEvenProbability(observations)!,
      bootstrapLower95At15x: null,
      criterion2Pass: false,
      setupMeanRealizedR: setupMean,
      random95MeanR: random95,
      criterion3Pass: setupMean !== null && random95 !== null && setupMean > random95,
      verdict: "PAS D'EDGE",
    },
    baselines,
    modelBySide: models,
  };
}

export function finalizeCriteria(
  base: Phase3PartitionReport,
  stressedBootstrap: MeanBootstrapInterval | null,
): Phase3PartitionReport {
  const c1 = base.criteria.criterion1Pass;
  const lower = stressedBootstrap?.lower ?? null;
  const c2 = lower !== null && lower > 0;
  const c3 = base.criteria.criterion3Pass;
  const criteria = {
    ...base.criteria,
    bootstrapLower95At15x: lower,
    criterion2Pass: c2,
    verdict: c1 && c2 && c3 ? "EDGE" as const : "PAS D'EDGE" as const,
  };
  return { ...base, criteria };
}
