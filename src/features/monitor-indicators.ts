import type { FeatureDefinition, FeatureSnapshot, MarketDataPoint } from "../domain/types.js";
import type { FeatureContext } from "./feature-engine.js";
import { exponentialMovingAverage, rsi, trueRange } from "./indicators.js";

/**
 * Monitor feature set (monitor-v1).
 *
 * Descriptive market context for the surveillance tool. This set is deliberately
 * separate from `core-v1` (feature-engine.ts): core-v1 feeds the frozen Phase 3
 * research and the frozen terminal estimator, and must never change.
 *
 * Nothing here is a validated predictor. No function in this file is read by the
 * probability, expectancy, decision or research code.
 *
 * Point-in-time: every function reads only the points it receives and treats the
 * last point as the decision candle.
 */
export const MONITOR_FEATURE_SET_ID = "monitor-v1";

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

/** SMA-seeded EMA series. Output index k corresponds to input index k + period - 1. */
function emaSeries(values: readonly number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const alpha = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i += 1) ema += values[i] ?? Number.NaN;
  ema /= period;
  const out: number[] = [ema];
  for (let i = period; i < values.length; i += 1) {
    ema = alpha * (values[i] ?? Number.NaN) + (1 - alpha) * ema;
    out.push(ema);
  }
  return out;
}

export interface MacdResult {
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
}

/** MACD line, signal line and histogram. Needs at least slow + signal - 1 closes. */
export function macd(closes: readonly number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult | null {
  if (fast <= 0 || slow <= fast || signalPeriod <= 0) return null;
  if (closes.length < slow + signalPeriod - 1) return null;
  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);
  const offset = slow - fast;
  const line = slowSeries.map((slowValue, index) => (fastSeries[index + offset] ?? Number.NaN) - slowValue);
  const signalSeries = emaSeries(line, signalPeriod);
  const macdValue = finite(line.at(-1));
  const signalValue = finite(signalSeries.at(-1));
  if (macdValue === null || signalValue === null) return null;
  return { macd: macdValue, signal: signalValue, histogram: macdValue - signalValue };
}

export interface BollingerResult {
  readonly middle: number;
  readonly upper: number;
  readonly lower: number;
  /** (close - lower) / (upper - lower); null on a flat window. */
  readonly percentB: number | null;
  /** (upper - lower) / middle; null if middle is zero. */
  readonly bandwidth: number | null;
}

/** Bollinger bands with population standard deviation (standard convention). */
export function bollingerBands(closes: readonly number[], period = 20, deviations = 2): BollingerResult | null {
  if (period <= 1 || closes.length < period) return null;
  const window = closes.slice(-period);
  const middle = window.reduce((sum, value) => sum + value, 0) / period;
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const sd = Math.sqrt(Math.max(variance, 0));
  const upper = middle + deviations * sd;
  const lower = middle - deviations * sd;
  const last = closes.at(-1);
  if (last === undefined || !Number.isFinite(middle)) return null;
  return {
    middle,
    upper,
    lower,
    percentB: upper === lower ? null : finite((last - lower) / (upper - lower)),
    bandwidth: middle === 0 ? null : finite((upper - lower) / middle),
  };
}

export interface AdxResult {
  readonly adx: number;
  readonly plusDI: number;
  readonly minusDI: number;
}

/** Wilder ADX with +DI / -DI. Needs at least 2 * period points. */
export function adx(points: readonly MarketDataPoint[], period = 14): AdxResult | null {
  if (period <= 1 || points.length < 2 * period) return null;
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    if (!current || !previous) return null;
    const up = current.high - previous.high;
    const down = previous.low - current.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(trueRange(current, previous.close));
  }

  let smoothTr = 0;
  let smoothPlus = 0;
  let smoothMinus = 0;
  for (let i = 0; i < period; i += 1) {
    smoothTr += tr[i] ?? Number.NaN;
    smoothPlus += plusDm[i] ?? Number.NaN;
    smoothMinus += minusDm[i] ?? Number.NaN;
  }

  const dxValues: number[] = [];
  let plusDi = 0;
  let minusDi = 0;
  const record = (): void => {
    plusDi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
    minusDi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;
    const total = plusDi + minusDi;
    dxValues.push(total === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / total);
  };
  record();
  for (let i = period; i < tr.length; i += 1) {
    smoothTr = smoothTr - smoothTr / period + (tr[i] ?? Number.NaN);
    smoothPlus = smoothPlus - smoothPlus / period + (plusDm[i] ?? Number.NaN);
    smoothMinus = smoothMinus - smoothMinus / period + (minusDm[i] ?? Number.NaN);
    record();
  }

  if (dxValues.length < period) return null;
  let adxValue = dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < dxValues.length; i += 1) {
    adxValue = (adxValue * (period - 1) + (dxValues[i] ?? Number.NaN)) / period;
  }
  const safeAdx = finite(adxValue);
  const safePlus = finite(plusDi);
  const safeMinus = finite(minusDi);
  if (safeAdx === null || safePlus === null || safeMinus === null) return null;
  return { adx: safeAdx, plusDI: safePlus, minusDI: safeMinus };
}

/** Stochastic RSI in [0, 1]. Null when the RSI window is flat. */
export function stochasticRsi(closes: readonly number[], rsiPeriod = 14, stochPeriod = 14): number | null {
  if (rsiPeriod <= 0 || stochPeriod <= 1 || closes.length < rsiPeriod + stochPeriod) return null;
  const values: number[] = [];
  for (let end = closes.length - stochPeriod + 1; end <= closes.length; end += 1) {
    const value = rsi(closes.slice(0, end), rsiPeriod);
    if (value === null) return null;
    values.push(value);
  }
  const high = Math.max(...values);
  const low = Math.min(...values);
  const latest = values.at(-1);
  if (latest === undefined || high === low) return null;
  return finite((latest - low) / (high - low));
}

/**
 * On-balance-volume change over the last `period` candles, divided by the volume
 * traded over the same candles. Scale-free, in [-1, 1].
 */
export function obvTrend(points: readonly MarketDataPoint[], period = 20): number | null {
  if (period <= 0 || points.length < period + 1) return null;
  let change = 0;
  let totalVolume = 0;
  for (let i = points.length - period; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    if (!current || !previous) return null;
    const direction = current.close > previous.close ? 1 : current.close < previous.close ? -1 : 0;
    change += direction * current.volume;
    totalVolume += current.volume;
  }
  return totalVolume <= 0 ? null : finite(change / totalVolume);
}

/**
 * Close relative to the rolling VWAP of the last `period` candles
 * (typical price = (high + low + close) / 3). Rolling, not session-anchored.
 */
export function rollingVwapDeviation(points: readonly MarketDataPoint[], period = 24): number | null {
  if (period <= 0 || points.length < period) return null;
  let priceVolume = 0;
  let volume = 0;
  for (const point of points.slice(-period)) {
    priceVolume += ((point.high + point.low + point.close) / 3) * point.volume;
    volume += point.volume;
  }
  const last = points.at(-1);
  if (volume <= 0 || last === undefined) return null;
  const vwap = priceVolume / volume;
  return vwap === 0 ? null : finite(last.close / vwap - 1);
}

export interface DonchianResult {
  readonly upper: number;
  readonly lower: number;
  /** (close - lower) / (upper - lower). Above 1 or below 0 means the close broke the prior channel. */
  readonly position: number | null;
}

/** Donchian channel over the `period` candles BEFORE the decision candle. */
export function donchianChannel(points: readonly MarketDataPoint[], period = 20): DonchianResult | null {
  if (period <= 0 || points.length < period + 1) return null;
  const prior = points.slice(-(period + 1), -1);
  const upper = Math.max(...prior.map((point) => point.high));
  const lower = Math.min(...prior.map((point) => point.low));
  const last = points.at(-1);
  if (last === undefined || !Number.isFinite(upper) || !Number.isFinite(lower)) return null;
  return { upper, lower, position: upper === lower ? null : finite((last.close - lower) / (upper - lower)) };
}

export interface SupportResistanceResult {
  readonly support: number | null;
  readonly resistance: number | null;
  /** (close - support) / close */
  readonly supportDistance: number | null;
  /** (resistance - close) / close */
  readonly resistanceDistance: number | null;
}

/**
 * Nearest confirmed swing low below the close and swing high above it.
 * A swing high needs `left` strictly lower highs before it and `right` non-higher
 * highs after it (mirrored for lows). A pivot is only confirmed `right` candles
 * later, so the most recent `right` candles can never be pivots (no look-ahead).
 */
export function swingSupportResistance(
  points: readonly MarketDataPoint[],
  left = 3,
  right = 3,
  lookback = 100,
): SupportResistanceResult | null {
  if (left < 1 || right < 1 || lookback < left + right + 1) return null;
  const count = points.length;
  if (count < left + right + 1) return null;
  const last = points[count - 1];
  if (!last || last.close <= 0) return null;

  const firstIndex = Math.max(left, count - lookback);
  const lastPivotIndex = count - 1 - right;
  let resistance: number | null = null;
  let support: number | null = null;
  for (let i = firstIndex; i <= lastPivotIndex; i += 1) {
    const pivot = points[i];
    if (!pivot) return null;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j += 1) {
      if (j === i) continue;
      const other = points[j];
      if (!other) return null;
      if (j < i) {
        if (other.high >= pivot.high) isHigh = false;
        if (other.low <= pivot.low) isLow = false;
      } else {
        if (other.high > pivot.high) isHigh = false;
        if (other.low < pivot.low) isLow = false;
      }
    }
    if (isHigh && pivot.high > last.close && (resistance === null || pivot.high < resistance)) resistance = pivot.high;
    if (isLow && pivot.low < last.close && (support === null || pivot.low > support)) support = pivot.low;
  }
  return {
    support,
    resistance,
    supportDistance: support === null ? null : (last.close - support) / last.close,
    resistanceDistance: resistance === null ? null : (resistance - last.close) / last.close,
  };
}

/** Close relative to its long EMA: close / EMA(period) - 1. */
export function priceVsEma(closes: readonly number[], period = 200): number | null {
  const ema = exponentialMovingAverage(closes, period);
  const last = closes.at(-1);
  if (ema === null || ema === 0 || last === undefined) return null;
  return finite(last / ema - 1);
}

function definition(
  featureId: string,
  name: string,
  description: string,
  parameters: Readonly<Record<string, string | number | boolean>>,
  requiredInputs: readonly string[],
): FeatureDefinition {
  return {
    featureId,
    version: "1.0.0",
    name,
    description: description + " (" + MONITOR_FEATURE_SET_ID + ", descriptive, not a validated predictor)",
    parameters,
    requiredInputs,
    availabilityRule: "inputs available at event timestamp",
    missingDataPolicy: "partial",
  };
}

export const MONITOR_FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  definition("trend.price_vs_ema200", "Price vs EMA 200", "Close relative to EMA 200", { period: 200 }, ["close"]),
  definition("trend.adx", "ADX", "Wilder ADX, trend strength regardless of direction", { period: 14 }, ["ohlc"]),
  definition("trend.di_spread", "DI spread", "+DI minus -DI, trend direction", { period: 14 }, ["ohlc"]),
  definition("momentum.macd_hist_norm", "MACD histogram (normalized)", "MACD histogram divided by close", { fast: 12, slow: 26, signal: 9 }, ["close"]),
  definition("momentum.stoch_rsi", "Stochastic RSI", "RSI position inside its recent range, 0 to 1", { rsiPeriod: 14, stochPeriod: 14 }, ["close"]),
  definition("volatility.bb_percent_b", "Bollinger %B", "Close position inside Bollinger bands", { period: 20, deviations: 2 }, ["close"]),
  definition("volatility.bb_bandwidth", "Bollinger bandwidth", "Band width relative to the middle band", { period: 20, deviations: 2 }, ["close"]),
  definition("volume.obv_trend", "OBV trend", "OBV change over period divided by period volume", { period: 20 }, ["close", "volume"]),
  definition("volume.vwap_deviation", "Rolling VWAP deviation", "Close relative to rolling VWAP", { period: 24 }, ["ohlc", "volume"]),
  definition("structure.donchian_position", "Donchian position", "Close position inside the prior Donchian channel", { period: 20 }, ["ohlc"]),
  definition("structure.support_distance", "Distance to support", "Distance to nearest confirmed swing low", { left: 3, right: 3, lookback: 100 }, ["ohlc"]),
  definition("structure.resistance_distance", "Distance to resistance", "Distance to nearest confirmed swing high", { left: 3, right: 3, lookback: 100 }, ["ohlc"]),
];

/** Computes monitor-v1 features. A feature without enough history is null, never invented. */
export function computeMonitorFeatures(context: FeatureContext): FeatureSnapshot[] {
  const points = context.points;
  const closes = points.map((point) => point.close);
  const latestClose = closes.at(-1);

  const macdResult = macd(closes);
  const bands = bollingerBands(closes);
  const adxResult = adx(points);
  const donchian = donchianChannel(points);
  const levels = swingSupportResistance(points);

  const values = new Map<string, number | null>([
    ["trend.price_vs_ema200", priceVsEma(closes)],
    ["trend.adx", adxResult?.adx ?? null],
    ["trend.di_spread", adxResult ? adxResult.plusDI - adxResult.minusDI : null],
    ["momentum.macd_hist_norm", macdResult && latestClose ? finite(macdResult.histogram / latestClose) : null],
    ["momentum.stoch_rsi", stochasticRsi(closes)],
    ["volatility.bb_percent_b", bands?.percentB ?? null],
    ["volatility.bb_bandwidth", bands?.bandwidth ?? null],
    ["volume.obv_trend", obvTrend(points)],
    ["volume.vwap_deviation", rollingVwapDeviation(points)],
    ["structure.donchian_position", donchian?.position ?? null],
    ["structure.support_distance", levels?.supportDistance ?? null],
    ["structure.resistance_distance", levels?.resistanceDistance ?? null],
  ]);

  return MONITOR_FEATURE_DEFINITIONS.map((item) => ({
    featureId: item.featureId,
    featureVersion: item.version,
    instrumentId: context.instrumentId,
    eventTime: context.eventTime,
    availableTime: context.availableTime,
    value: values.get(item.featureId) ?? null,
    inputDataVersion: context.dataVersion,
  }));
}
