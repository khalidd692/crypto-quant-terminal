import type { MarketDataPoint } from "../domain/types.js";

export interface FeatureValue {
  readonly name: string;
  readonly value: number | null;
  readonly asOf: string;
}

export function simpleMovingAverage(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function exponentialMovingAverage(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const alpha = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) ema = alpha * value + (1 - alpha) * ema;
  return ema;
}

export function trueRange(current: MarketDataPoint, previousClose: number | null): number {
  if (previousClose === null) return current.high - current.low;
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose),
  );
}

export function averageTrueRange(points: readonly MarketDataPoint[], period: number): number | null {
  if (points.length < period || period <= 0) return null;
  const ranges: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    ranges.push(trueRange(points[i], i === 0 ? null : points[i - 1].close));
  }
  return simpleMovingAverage(ranges, period);
}

export function rsi(closes: readonly number[], period = 14): number | null {
  if (period <= 0 || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function logReturns(closes: readonly number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i] > 0 && closes[i - 1] > 0) result.push(Math.log(closes[i] / closes[i - 1]));
  }
  return result;
}

export function realizedVolatility(closes: readonly number[], period: number): number | null {
  const returns = logReturns(closes);
  if (returns.length < period || period <= 1) return null;
  const sample = returns.slice(-period);
  const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
  const variance = sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sample.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

export function volumeZScore(points: readonly MarketDataPoint[], period: number): number | null {
  if (period <= 1 || points.length < period) return null;
  const values = points.slice(-period).map((p) => p.volume);
  const mean = values.reduce((a, b) => a + b, 0) / period;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (period - 1);
  const sd = Math.sqrt(Math.max(variance, 0));
  if (sd === 0) return 0;
  return (values[values.length - 1] - mean) / sd;
}

export function rangePosition(point: MarketDataPoint): number | null {
  const range = point.high - point.low;
  if (range <= 0) return null;
  return (point.close - point.low) / range;
}
