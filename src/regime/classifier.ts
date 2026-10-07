import type { FeatureSnapshot, Regime } from "../domain/types.js";

export interface RegimeClassifierInput {
  readonly instrumentId: string;
  readonly eventTime: string;
  readonly featureSnapshots: readonly FeatureSnapshot[];
  readonly version: string;
}

export function classifyBasicRegime(input: RegimeClassifierInput): Regime {
  const get = (id: string): number | null => input.featureSnapshots.find((feature) => feature.featureId === id)?.value ?? null;
  const trend = get("trend.ema_ratio");
  const volatility = get("volatility.realized");

  let label = "UNDEFINED";
  if (trend !== null && volatility !== null) {
    if (trend > 0.002 && volatility < 0.03) label = "TREND_UP_CALM";
    else if (trend < -0.002 && volatility < 0.03) label = "TREND_DOWN_CALM";
    else if (volatility >= 0.03) label = "HIGH_VOLATILITY";
    else label = "RANGE";
  }

  return {
    regimeId: `basic:${input.version}:${input.instrumentId}:${input.eventTime}`,
    version: input.version,
    instrumentId: input.instrumentId,
    eventTime: input.eventTime as Regime["eventTime"],
    label,
    confidence: null,
    featureSnapshotIds: input.featureSnapshots.map((_feature, index) => `feature-${index}` as Regime["featureSnapshotIds"][number]),
  };
}
