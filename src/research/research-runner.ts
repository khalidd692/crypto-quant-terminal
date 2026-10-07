import type { MarketDataPoint } from "../domain/types.js";
import { computeCoreFeatures } from "../features/feature-engine.js";
import { assessBasicTrendSetup } from "../setup/basic.js";
import { simulateOutcome } from "../simulation/outcomes.js";
import { createResearchObservation, type ResearchObservation } from "./observation-ledger.js";

export interface ResearchRunnerConfig {
  readonly lookback: number;
  readonly horizonCandles: number;
  readonly targetR: number;
  readonly invalidationR: number;
  readonly feeRate: number;
  readonly slippageRate: number;
  readonly fundingReturnFractionPerHoldingPeriod?: number;
  readonly dataVersion: string;
  readonly featureVersionPolicy: string;
}

function featuresFor(points: readonly MarketDataPoint[], index: number, config: ResearchRunnerConfig) {
  const point = points[index];
  if (!point) throw new Error("Research index out of range");
  return computeCoreFeatures({
    instrumentId: point.instrumentId,
    eventTime: point.eventTime,
    availableTime: point.availableTime,
    dataVersion: config.dataVersion,
    points: points.slice(0, index + 1),
  });
}

export function runResearchLedger(
  points: readonly MarketDataPoint[],
  config: ResearchRunnerConfig,
): readonly ResearchObservation[] {
  if (config.lookback < 1 || config.horizonCandles < 1) throw new Error("lookback and horizonCandles must be positive");
  if (config.targetR <= 0 || config.invalidationR <= 0) throw new Error("targetR and invalidationR must be positive");
  if (config.feeRate < 0 || config.slippageRate < 0) throw new Error("cost rates cannot be negative");
  if (points.length === 0) return [];

  const output: ResearchObservation[] = [];
  const lastEligibleIndex = points.length - config.horizonCandles - 1;

  for (let i = config.lookback; i <= lastEligibleIndex; i += 1) {
    const entry = points[i];
    if (!entry) continue;

    const features = featuresFor(points, i, config);
    const setup = assessBasicTrendSetup(features);
    const featureVersions = features.map((f) => `${f.featureId}@${f.featureVersion}`).sort();

    if (!setup.valid || setup.side === null) {
      output.push(createResearchObservation({
        instrumentId: entry.instrumentId,
        eventTime: entry.eventTime,
        availableTime: entry.availableTime,
        datasetVersion: config.dataVersion,
        featureDefinitionVersions: featureVersions,
        featureSnapshot: features,
        setupId: null,
        side: null,
        entryReferencePrice: entry.close,
        horizonCandles: config.horizonCandles,
        horizonEndTime: points[i + config.horizonCandles]?.eventTime ?? null,
        targetR: null,
        invalidationR: null,
        outcome: null,
        eligible: false,
        exclusionReason: "NO_BASELINE_SETUP",
      }));
      continue;
    }

    const atrRatio = features.find((feature) => feature.featureId === "volatility.atr_ratio")?.value;
    if (atrRatio === null || atrRatio === undefined || !Number.isFinite(atrRatio) || atrRatio <= 0) {
      output.push(createResearchObservation({
        instrumentId: entry.instrumentId,
        eventTime: entry.eventTime,
        availableTime: entry.availableTime,
        datasetVersion: config.dataVersion,
        featureDefinitionVersions: featureVersions,
        featureSnapshot: features,
        setupId: "baseline.trend.v1",
        side: setup.side,
        entryReferencePrice: entry.close,
        horizonCandles: config.horizonCandles,
        horizonEndTime: points[i + config.horizonCandles]?.eventTime ?? null,
        targetR: config.targetR,
        invalidationR: config.invalidationR,
        outcome: null,
        eligible: false,
        exclusionReason: "INVALID_ATR",
      }));
      continue;
    }

    const atr = entry.close * atrRatio;
    const targetPrice = setup.side === "LONG"
      ? entry.close + config.targetR * atr
      : entry.close - config.targetR * atr;
    const invalidationPrice = setup.side === "LONG"
      ? entry.close - config.invalidationR * atr
      : entry.close + config.invalidationR * atr;
    const future = points.slice(i + 1, i + 1 + config.horizonCandles);
    const simulated = simulateOutcome(entry, future, {
      side: setup.side,
      entryPrice: entry.close,
      targetPrice,
      invalidationPrice,
      feeRate: config.feeRate,
      slippageRate: config.slippageRate,
    });

    const label = simulated.intrabarAmbiguous
      ? "AMBIGUOUS"
      : simulated.targetHit
        ? "TARGET"
        : simulated.invalidationHit
          ? "INVALIDATION"
          : "TIME_EXIT";

    const risk = Math.abs(entry.close - invalidationPrice);
    const grossR = directionalR(entry.close, simulated.exitPrice, setup.side, risk);
    const fundingReturnFraction = config.fundingReturnFractionPerHoldingPeriod ?? 0;
    const realizedR = (simulated.returnFraction - fundingReturnFraction) / (risk / entry.close);

    output.push(createResearchObservation({
      instrumentId: entry.instrumentId,
      eventTime: entry.eventTime,
      availableTime: entry.availableTime,
      datasetVersion: config.dataVersion,
      featureDefinitionVersions: featureVersions,
      featureSnapshot: features,
      setupId: "baseline.trend.v1",
      side: setup.side,
      entryReferencePrice: entry.close,
      horizonCandles: config.horizonCandles,
      horizonEndTime: future.at(-1)?.eventTime ?? null,
      targetR: config.targetR,
      invalidationR: config.invalidationR,
      outcome: {
        label,
        targetHit: simulated.targetHit,
        invalidationHit: simulated.invalidationHit,
        timeExit: !simulated.targetHit && !simulated.invalidationHit && !simulated.intrabarAmbiguous,
        intrabarAmbiguous: simulated.intrabarAmbiguous,
        mfeR: simulated.mfeR,
        maeR: simulated.maeR,
        realizedR,
        returnFraction: simulated.returnFraction - fundingReturnFraction,
        exitPrice: simulated.exitPrice,
        exitEventTime: future.at(-1)?.eventTime ?? entry.eventTime,
        feesReturn: 2 * config.feeRate,
        slippageReturn: 2 * config.slippageRate,
        fundingReturn: fundingReturnFraction,
      },
      eligible: true,
      exclusionReason: null,
    }));
  }

  return output;
}

function directionalR(entry: number, exit: number, side: "LONG" | "SHORT", risk: number): number {
  if (risk <= 0) throw new Error("risk must be positive");
  const directional = side === "LONG" ? exit - entry : entry - exit;
  return directional / risk;
}
