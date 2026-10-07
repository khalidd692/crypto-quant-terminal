import type { FeatureSnapshot, Side } from "../domain/types.js";

export const BASELINE_SETUP_ID = "baseline.trend.v1";

export interface SetupAssessment {
  readonly valid: boolean;
  readonly side: Side | null;
  readonly setupId: string;
  readonly reasons: readonly string[];
}

export function assessBasicTrendSetup(features: readonly FeatureSnapshot[]): SetupAssessment {
  const get = (id: string): number | null => features.find((feature) => feature.featureId === id)?.value ?? null;
  const trend = get("trend.ema_ratio");
  const rsi = get("momentum.rsi");
  const volatility = get("volatility.realized");
  const reasons: string[] = [];

  if (trend === null) reasons.push("missing_trend");
  if (rsi === null) reasons.push("missing_momentum");
  if (volatility === null) reasons.push("missing_volatility");
  if (reasons.length > 0) return { valid: false, side: null, setupId: BASELINE_SETUP_ID, reasons };

  if (trend !== null && trend > 0.002 && rsi !== null && rsi >= 50 && rsi <= 70) {
    return { valid: true, side: "LONG", setupId: BASELINE_SETUP_ID, reasons: ["trend_up", "momentum_confirmed"] };
  }
  if (trend !== null && trend < -0.002 && rsi !== null && rsi >= 30 && rsi <= 50) {
    return { valid: true, side: "SHORT", setupId: BASELINE_SETUP_ID, reasons: ["trend_down", "momentum_confirmed"] };
  }
  return { valid: false, side: null, setupId: BASELINE_SETUP_ID, reasons: ["setup_not_confirmed"] };
}
