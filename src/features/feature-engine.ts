import type { FeatureDefinition, FeatureSnapshot, ISO8601, MarketDataPoint } from "../domain/types.js";
import {
  averageTrueRange,
  exponentialMovingAverage,
  realizedVolatility,
  rangePosition,
  rsi,
  simpleMovingAverage,
  volumeZScore,
} from "./indicators.js";

export interface FeatureContext {
  readonly instrumentId: string;
  readonly eventTime: ISO8601;
  readonly availableTime: ISO8601;
  readonly dataVersion: string;
  readonly points: readonly MarketDataPoint[];
}

export const CORE_FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  { featureId: "trend.ema_ratio", version: "1.0.0", name: "EMA ratio", description: "Short EMA relative to long EMA", parameters: { short: 20, long: 50 }, requiredInputs: ["close"], availabilityRule: "close available at event timestamp", missingDataPolicy: "reject" },
  { featureId: "momentum.rsi", version: "1.0.0", name: "RSI", description: "Wilder-style RSI", parameters: { period: 14 }, requiredInputs: ["close"], availabilityRule: "close available at event timestamp", missingDataPolicy: "reject" },
  { featureId: "volatility.atr_ratio", version: "1.0.0", name: "ATR ratio", description: "ATR divided by close", parameters: { period: 14 }, requiredInputs: ["ohlc"], availabilityRule: "OHLC available at event timestamp", missingDataPolicy: "reject" },
  { featureId: "volatility.realized", version: "1.0.0", name: "Realized volatility", description: "Sample standard deviation of log returns", parameters: { period: 20 }, requiredInputs: ["close"], availabilityRule: "close available at event timestamp", missingDataPolicy: "reject" },
  { featureId: "volume.zscore", version: "1.0.0", name: "Volume z-score", description: "Current volume standardized over rolling window", parameters: { period: 20 }, requiredInputs: ["volume"], availabilityRule: "volume available at event timestamp", missingDataPolicy: "reject" },
  { featureId: "price.range_position", version: "1.0.0", name: "Range position", description: "Close position inside current candle range", parameters: {}, requiredInputs: ["ohlc"], availabilityRule: "OHLC available at event timestamp", missingDataPolicy: "reject" },
];

function snapshot(definition: FeatureDefinition, context: FeatureContext, value: number | null): FeatureSnapshot {
  return {
    featureId: definition.featureId,
    featureVersion: definition.version,
    instrumentId: context.instrumentId,
    eventTime: context.eventTime,
    availableTime: context.availableTime,
    value,
    inputDataVersion: context.dataVersion,
  };
}

export function computeCoreFeatures(context: FeatureContext): FeatureSnapshot[] {
  const closes = context.points.map((point) => point.close);
  const ema20 = exponentialMovingAverage(closes, 20);
  const ema50 = exponentialMovingAverage(closes, 50);
  const atr = averageTrueRange(context.points, 14);
  const volatility = realizedVolatility(closes, 20);
  const volumeZ = volumeZScore(context.points, 20);
  const range = rangePosition(context.points[context.points.length - 1]);
  const rsi14 = rsi(closes, 14);

  const values = new Map<string, number | null>([
    ["trend.ema_ratio", ema20 !== null && ema50 !== null && ema50 !== 0 ? ema20 / ema50 - 1 : null],
    ["momentum.rsi", rsi14],
    ["volatility.atr_ratio", atr !== null && closes.at(-1) !== undefined ? atr / closes.at(-1) : null],
    ["volatility.realized", volatility],
    ["volume.zscore", volumeZ],
    ["price.range_position", range],
  ]);

  return CORE_FEATURE_DEFINITIONS.map((definition) => snapshot(definition, context, values.get(definition.featureId) ?? null));
}

export function requireFeatureHistory(points: readonly MarketDataPoint[], minimumPoints = 50): void {
  if (points.length < minimumPoints) throw new Error(`Insufficient history: need at least ${minimumPoints} points`);
}
