import type { ISO8601, MarketDataPoint } from "../src/domain/types.js";
import { CORE_FEATURE_DEFINITIONS, computeCoreFeatures } from "../src/features/feature-engine.js";
import {
  MONITOR_FEATURE_DEFINITIONS,
  adx,
  bollingerBands,
  computeMonitorFeatures,
  donchianChannel,
  macd,
  obvTrend,
  priceVsEma,
  rollingVwapDeviation,
  stochasticRsi,
  swingSupportResistance,
} from "../src/features/monitor-indicators.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function near(name: string, actual: number | null | undefined, expected: number, tolerance: number): void {
  if (actual === null || actual === undefined) throw new Error(`${name}: got null, expected ${expected}`);
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${name}: got ${actual}, expected ${expected} (tolerance ${tolerance})`);
  }
}

function makePoint(index: number, open: number, high: number, low: number, close: number, volume: number): MarketDataPoint {
  const time = new Date(Date.UTC(2026, 0, 1, index)).toISOString() as ISO8601;
  return { instrumentId: "TEST", eventTime: time, availableTime: time, open, high, low, close, volume, dataQuality: "complete", sourceId: "fixture" };
}

// Deterministic series, identical to the Python reference used to produce the expected values.
function referenceSeries(count: number): MarketDataPoint[] {
  let state = 20261008;
  const next = (): number => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const points: MarketDataPoint[] = [];
  let previous = 100;
  for (let k = 0; k < count; k += 1) {
    const u1 = next();
    const u2 = next();
    const u3 = next();
    const u4 = next();
    const open = previous;
    const close = previous * (1 + (u1 - 0.5) * 0.04);
    const high = Math.max(open, close) * (1 + u2 * 0.01);
    const low = Math.min(open, close) * (1 - u3 * 0.01);
    points.push(makePoint(k, open, high, low, close, 1000 + Math.floor(u4 * 9000)));
    previous = close;
  }
  return points;
}

const points = referenceSeries(400);
const closes = points.map((point) => point.close);

// The fixture must match the Python reference bit for bit before any comparison means anything.
near("fixture checksum close", closes.reduce((a, b) => a + b, 0), 37377.31888885408, 1e-7);
near("fixture checksum volume", points.reduce((a, p) => a + p.volume, 0), 2208297, 0);

// 1. Cross-check against TA-Lib 0.8.1 (and independent numpy code for VWAP, Donchian, pivots).
const macdResult = macd(closes);
near("macd line", macdResult?.macd, -0.5733684430473431, 1e-7);
near("macd signal", macdResult?.signal, -0.5938907365922643, 1e-7);
near("macd histogram", macdResult?.histogram, 0.02052229354492119, 1e-7);

const bands = bollingerBands(closes);
near("bollinger percentB", bands?.percentB, 0.48103101283422417, 1e-9);
near("bollinger bandwidth", bands?.bandwidth, 0.05092538863979385, 1e-9);

const adxResult = adx(points);
near("adx", adxResult?.adx, 15.704531252134913, 1e-6);
near("plusDI", adxResult?.plusDI, 18.07056049516336, 1e-6);
near("minusDI", adxResult?.minusDI, 16.991699166922466, 1e-6);

near("stochastic rsi", stochasticRsi(closes), 0.7199437283708324, 1e-7);
near("obv trend", obvTrend(points), 0.007311940652916179, 1e-9);
near("vwap deviation", rollingVwapDeviation(points), -0.0011904164335754253, 1e-12);
near("donchian position", donchianChannel(points)?.position, 0.5050967012008822, 1e-12);
near("price vs ema200", priceVsEma(closes), -0.0410439909452619, 1e-9);

const levels = swingSupportResistance(points);
near("resistance", levels?.resistance, 88.28876491930086, 1e-12);
near("support", levels?.support, 86.57464008998713, 1e-12);
near("support distance", levels?.supportDistance, 0.00983334474795965, 1e-12);
near("resistance distance", levels?.resistanceDistance, 0.009771348348793427, 1e-12);

// 2. Insufficient history yields null, never an invented number.
const short = points.slice(0, 20);
const shortCloses = short.map((point) => point.close);
assert(macd(shortCloses) === null, "macd must be null on short history");
assert(adx(short) === null, "adx must be null on short history");
assert(stochasticRsi(shortCloses) === null, "stochRsi must be null on short history");
assert(priceVsEma(shortCloses) === null, "ema200 ratio must be null on short history");
assert(donchianChannel(short.slice(0, 20)) === null, "donchian needs period + 1 points");
assert(bollingerBands(shortCloses.slice(0, 5)) === null, "bollinger must be null on short history");
assert(swingSupportResistance(short.slice(0, 5)) === null, "pivots must be null on very short history");

// 3. Degenerate inputs.
const flat = Array.from({ length: 60 }, (_, i) => makePoint(i, 100, 100, 100, 100, 0));
const flatCloses = flat.map((point) => point.close);
assert(bollingerBands(flatCloses)?.percentB === null, "flat window has no %B");
assert(bollingerBands(flatCloses)?.bandwidth === 0, "flat window has zero bandwidth");
assert(stochasticRsi(flatCloses) === null, "flat RSI window has no stochastic RSI");
assert(obvTrend(flat) === null, "zero volume has no OBV trend");
assert(rollingVwapDeviation(flat) === null, "zero volume has no VWAP");
assert(donchianChannel(flat)?.position === null, "flat channel has no position");
assert(adx(flat)?.adx === 0, "flat market has ADX 0");

// 4. No look-ahead: a spike in the last `right` candles is not a confirmed pivot.
const spikeBase = Array.from({ length: 40 }, (_, i) => makePoint(i, 100, 101, 99, 100, 1000));
const withUnconfirmedSpike = spikeBase.map((point, i) =>
  i === 38 ? makePoint(i, 100, 120, 99, 100, 1000) : point,
);
assert(swingSupportResistance(withUnconfirmedSpike)?.resistance !== 120, "unconfirmed spike must not be a pivot");
const withConfirmedSpike = spikeBase.map((point, i) =>
  i === 30 ? makePoint(i, 100, 120, 99, 100, 1000) : point,
);
near("confirmed spike becomes resistance", swingSupportResistance(withConfirmedSpike)?.resistance, 120, 0);

// 5. Donchian uses the prior channel only: a breakout candle reads above 1.
const breakout = [...spikeBase, makePoint(40, 100, 125, 100, 124, 1000)];
const breakoutPosition = donchianChannel(breakout)?.position;
assert(breakoutPosition !== null && breakoutPosition !== undefined && breakoutPosition > 1, "breakout must read above the prior channel");

// 6. Feature set contract.
const context = {
  instrumentId: "TEST",
  eventTime: points[points.length - 1]!.eventTime,
  availableTime: points[points.length - 1]!.availableTime,
  dataVersion: "fixture",
  points,
};
const monitor = computeMonitorFeatures(context);
assert(monitor.length === MONITOR_FEATURE_DEFINITIONS.length, "one snapshot per monitor definition");
assert(monitor.every((snapshot) => snapshot.value !== null), "all monitor features computable on 400 candles");
const again = computeMonitorFeatures(context);
assert(JSON.stringify(monitor) === JSON.stringify(again), "monitor features must be deterministic");

const partial = computeMonitorFeatures({ ...context, points: points.slice(0, 40) });
const nullIds = partial.filter((snapshot) => snapshot.value === null).map((snapshot) => snapshot.featureId);
assert(nullIds.includes("trend.price_vs_ema200"), "EMA200 ratio is null on 40 candles");
assert(!nullIds.includes("volatility.bb_percent_b"), "Bollinger is available on 40 candles");

// 7. core-v1 is frozen: the Phase 3 research and the frozen estimator depend on it.
const coreIds = CORE_FEATURE_DEFINITIONS.map((definition) => definition.featureId);
assert(
  JSON.stringify(coreIds) === JSON.stringify([
    "trend.ema_ratio",
    "momentum.rsi",
    "volatility.atr_ratio",
    "volatility.realized",
    "volume.zscore",
    "price.range_position",
  ]),
  "core-v1 feature ids must never change",
);
assert(CORE_FEATURE_DEFINITIONS.every((definition) => definition.version === "1.0.0"), "core-v1 versions must never change");
assert(computeCoreFeatures(context).length === 6, "core-v1 still computes exactly six features");
const monitorIds = new Set(MONITOR_FEATURE_DEFINITIONS.map((definition) => definition.featureId));
assert(monitorIds.size === MONITOR_FEATURE_DEFINITIONS.length, "monitor feature ids must be unique");
assert(coreIds.every((id) => !monitorIds.has(id)), "monitor ids must not collide with core ids");

console.log("monitor-indicators: ok");
