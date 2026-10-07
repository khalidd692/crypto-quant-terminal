import type { FeatureSnapshot, Side } from "../domain/types.js";

export type Timeframe = "15m" | "1h" | "4h" | "1d";

export interface TimeframeSnapshot {
  readonly timeframe: Timeframe;
  readonly features: readonly FeatureSnapshot[];
}

export interface MultiTimeframeAlignment {
  readonly aligned: boolean;
  readonly side: Side | null;
  readonly reasons: readonly string[];
}

function value(snapshot: TimeframeSnapshot, featureId: string): number | null {
  return snapshot.features.find((feature) => feature.featureId === featureId)?.value ?? null;
}

export function assessMultiTimeframeAlignment(snapshots: readonly TimeframeSnapshot[]): MultiTimeframeAlignment {
  const byTf = new Map(snapshots.map((snapshot) => [snapshot.timeframe, snapshot]));
  const fifteen = byTf.get("15m");
  const oneHour = byTf.get("1h");
  const fourHour = byTf.get("4h");
  const oneDay = byTf.get("1d");
  const reasons: string[] = [];

  if (!fifteen || !oneHour || !fourHour || !oneDay) {
    return { aligned: false, side: null, reasons: ["missing_timeframe"] };
  }

  const trend1h = value(oneHour, "trend.ema_ratio");
  const trend4h = value(fourHour, "trend.ema_ratio");
  const trend1d = value(oneDay, "trend.ema_ratio");
  const rsi15 = value(fifteen, "momentum.rsi");
  const rsi1h = value(oneHour, "momentum.rsi");

  if ([trend1h, trend4h, trend1d, rsi15, rsi1h].some((item) => item === null)) {
    return { aligned: false, side: null, reasons: ["missing_alignment_feature"] };
  }

  if (trend1h !== null && trend4h !== null && trend1d !== null && rsi15 !== null && rsi1h !== null) {
    if (trend4h > 0 && trend1d > 0 && trend1h > 0 && rsi15 >= 45 && rsi15 <= 70 && rsi1h >= 50 && rsi1h <= 70) {
      reasons.push("15m_1h_4h_1d_bullish_alignment");
      return { aligned: true, side: "LONG", reasons };
    }
    if (trend4h < 0 && trend1d < 0 && trend1h < 0 && rsi15 >= 30 && rsi15 <= 55 && rsi1h >= 30 && rsi1h <= 50) {
      reasons.push("15m_1h_4h_1d_bearish_alignment");
      return { aligned: true, side: "SHORT", reasons };
    }
  }

  return { aligned: false, side: null, reasons: ["timeframe_disagreement"] };
}
