import { simulateOutcome } from "../src/simulation/outcomes.js";
import type { ISO8601, MarketDataPoint } from "../src/domain/types.js";

const SEED = 20261007;
const OBSERVATIONS = 100_000;
const HORIZON = 8;
const TARGET_R = 1.5;
const INVALIDATION_R = 1;
const INTRACANDLE_STEPS = 8;
const CANDLE_SIGMA = 0.525;
const BASE_RANGE_SIGMA = 0.25;
const WIDE_WICK_PROBABILITY = 0.002;
const WIDE_WICK_MEAN = 2;
const WIDE_WICK_SIGMA = 0.2;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function normal(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function candle(
  index: number,
  open: number,
  close: number,
  high: number,
  low: number,
): MarketDataPoint {
  return {
    instrumentId: "SYNTH",
    eventTime: new Date(Date.UTC(2026, 0, 1, index)).toISOString() as ISO8601,
    availableTime: new Date(Date.UTC(2026, 0, 1, index, 1)).toISOString() as ISO8601,
    open,
    high,
    low,
    close,
    volume: 100,
    dataQuality: "complete",
    sourceId: "synthetic-volatility-calibration",
  };
}

const random = rng(SEED);
const points: MarketDataPoint[] = [];
let price = 100;
for (let observation = 0; observation < OBSERVATIONS; observation += 1) {
  const entry = price;
  for (let candleIndex = 0; candleIndex < HORIZON; candleIndex += 1) {
    const open = price;
    let pathPrice = price;
    let high = price;
    let low = price;
    for (let step = 0; step < INTRACANDLE_STEPS; step += 1) {
      pathPrice += normal(random) * (CANDLE_SIGMA / Math.sqrt(INTRACANDLE_STEPS));
      high = Math.max(high, pathPrice);
      low = Math.min(low, pathPrice);
    }
    const close = pathPrice;
    const baseRange = Math.abs(normal(random)) * BASE_RANGE_SIGMA;
    high = Math.max(high, open + baseRange, close + baseRange * 0.7);
    low = Math.min(low, open - baseRange, close - baseRange * 0.7);

    if (random() < WIDE_WICK_PROBABILITY) {
      const wick = Math.abs(normal(random) * WIDE_WICK_SIGMA + WIDE_WICK_MEAN);
      high = Math.max(high, open + wick);
      low = Math.min(low, open - wick);
    }

    points.push(candle(observation * HORIZON + candleIndex, open, close, high, low));
    price = close;
  }
  price = entry;
}

type State = "TARGET" | "INVALIDATION" | "TIME_EXIT" | "AMBIGUOUS";
const counts: Record<State, number> = {
  TARGET: 0,
  INVALIDATION: 0,
  TIME_EXIT: 0,
  AMBIGUOUS: 0,
};
const sums: Record<State, number> = {
  TARGET: 0,
  INVALIDATION: 0,
  TIME_EXIT: 0,
  AMBIGUOUS: 0,
};

for (let observation = 0; observation < OBSERVATIONS; observation += 1) {
  const entryIndex = observation * HORIZON;
  const entry = points[entryIndex]!;
  const future = points.slice(entryIndex, entryIndex + HORIZON);
  const targetPrice = entry.close + TARGET_R;
  const invalidationPrice = entry.close - INVALIDATION_R;
  const result = simulateOutcome(entry, future, {
    side: "LONG",
    entryPrice: entry.close,
    targetPrice,
    invalidationPrice,
    feeRate: 0,
    slippageRate: 0,
  });
  const state: State = result.intrabarAmbiguous
    ? "AMBIGUOUS"
    : result.targetHit
      ? "TARGET"
      : result.invalidationHit
        ? "INVALIDATION"
        : "TIME_EXIT";
  counts[state] += 1;
  const realizedR = result.returnFraction;
  sums[state] += realizedR;
}

const cleanCount = counts.TARGET + counts.INVALIDATION + counts.TIME_EXIT;
const cleanMeanR = (sums.TARGET + sums.INVALIDATION + sums.TIME_EXIT) / cleanCount;
const targetShare = counts.TARGET / cleanCount;
const invalidationShare = counts.INVALIDATION / cleanCount;
const timeExitShare = counts.TIME_EXIT / cleanCount;
const ambiguousShare = counts.AMBIGUOUS / OBSERVATIONS;

console.log(JSON.stringify({
  seed: SEED,
  observations: OBSERVATIONS,
  geometry: {
    horizon: HORIZON,
    targetR: TARGET_R,
    invalidationR: INVALIDATION_R,
    candleSigma: CANDLE_SIGMA,
    intrabarSteps: INTRACANDLE_STEPS,
    wideWickProbability: WIDE_WICK_PROBABILITY,
  },
  counts,
  cleanCount,
  sharesAmongClean: {
    target: targetShare,
    invalidation: invalidationShare,
    timeExit: timeExitShare,
  },
  ambiguousShare,
  meanR: {
    cleanGlobal: cleanMeanR,
    target: sums.TARGET / counts.TARGET,
    invalidation: sums.INVALIDATION / counts.INVALIDATION,
    timeExit: sums.TIME_EXIT / counts.TIME_EXIT,
  },
}, null, 2));

if (Math.abs(cleanMeanR) > 0.03) {
  throw new Error(`Synthetic historical-geometry no-cost mean R is outside tolerance: ${cleanMeanR}`);
}
if (Math.abs(targetShare - 0.30) > 0.03) {
  throw new Error(`Target frequency is outside historical calibration band: ${targetShare}`);
}
if (Math.abs(invalidationShare - 0.48) > 0.03) {
  throw new Error(`Invalidation frequency is outside historical calibration band: ${invalidationShare}`);
}
if (Math.abs(timeExitShare - 0.22) > 0.03) {
  throw new Error(`TIME_EXIT frequency is outside historical calibration band: ${timeExitShare}`);
}
if (counts.AMBIGUOUS < 1) {
  throw new Error("Calibration must exercise the ambiguous intrabar path");
}
