import { simulateOutcome } from "../src/simulation/outcomes.js";
import type { ISO8601, MarketDataPoint } from "../src/domain/types.js";

const SEED = 20261007;
const HORIZON = 8;
const TARGET_R = 1.5;
const INVALIDATION_R = 1;
const FEE_RATE = 0.0004;
const SLIPPAGE_RATE = 0.0002;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function candle(index: number, open: number, close: number): MarketDataPoint {
  return {
    instrumentId: "SYNTH",
    eventTime: new Date(Date.UTC(2026, 0, 1, index)).toISOString() as ISO8601,
    availableTime: new Date(Date.UTC(2026, 0, 1, index, 1)).toISOString() as ISO8601,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: 100,
    dataQuality: "complete",
    sourceId: "synthetic-random-walk",
  };
}

const random = rng(SEED);
const points: MarketDataPoint[] = [candle(0, 100, 100)];
for (let i = 1; i < 50_001; i += 1) {
  const previous = points[i - 1]!.close;
  const step = random() < 0.5 ? -0.25 : 0.25;
  points.push(candle(i, previous, previous + step));
}

type State = "TARGET" | "INVALIDATION" | "TIME_EXIT" | "AMBIGUOUS";

interface Aggregate {
  count: number;
  sumR: number;
  byState: Record<State, { count: number; sumR: number }>;
  sumCostR: number;
}

function run(feeRate: number, slippageRate: number): Aggregate {
  const byState: Aggregate["byState"] = {
    TARGET: { count: 0, sumR: 0 },
    INVALIDATION: { count: 0, sumR: 0 },
    TIME_EXIT: { count: 0, sumR: 0 },
    AMBIGUOUS: { count: 0, sumR: 0 },
  };
  let sumR = 0;
  let sumCostR = 0;

  for (let i = 0; i + HORIZON < points.length; i += HORIZON) {
    const entry = points[i]!;
    const risk = 1;
    const targetPrice = entry.close + TARGET_R * risk;
    const invalidationPrice = entry.close - INVALIDATION_R * risk;
    const result = simulateOutcome(entry, points.slice(i + 1, i + 1 + HORIZON), {
      side: "LONG",
      entryPrice: entry.close,
      targetPrice,
      invalidationPrice,
      feeRate,
      slippageRate,
    });
    const state: State = result.intrabarAmbiguous
      ? "AMBIGUOUS"
      : result.targetHit
        ? "TARGET"
        : result.invalidationHit
          ? "INVALIDATION"
          : "TIME_EXIT";
    const realizedR = result.returnFraction / (risk / entry.close);
    const costR = (result.feeReturnFraction + result.slippageReturnFraction) / (risk / entry.close);
    byState[state].count += 1;
    byState[state].sumR += realizedR;
    sumR += realizedR;
    sumCostR += costR;
  }

  return { count: Object.values(byState).reduce((sum, item) => sum + item.count, 0), sumR, byState, sumCostR };
}

function mean(sum: number, count: number): number {
  return count ? sum / count : 0;
}

const free = run(0, 0);
const costed = run(FEE_RATE, SLIPPAGE_RATE);
const freeMean = mean(free.sumR, free.count);
const costedMean = mean(costed.sumR, costed.count);
const meanCostR = mean(costed.sumCostR, costed.count);

console.log(JSON.stringify({
  seed: SEED,
  observations: free.count,
  noCosts: {
    meanR: freeMean,
    byState: Object.fromEntries(Object.entries(free.byState).map(([state, value]) => [
      state,
      { count: value.count, meanR: mean(value.sumR, value.count) },
    ])),
  },
  adrCosts: {
    meanR: costedMean,
    meanCostR,
    byState: Object.fromEntries(Object.entries(costed.byState).map(([state, value]) => [
      state,
      { count: value.count, meanR: mean(value.sumR, value.count) },
    ])),
  },
}, null, 2));

if (Math.abs(freeMean) > 0.03) throw new Error(`Synthetic no-cost mean R is outside calibration tolerance: ${freeMean}`);
const netCostDeltaR = costedMean - freeMean;
if (!(netCostDeltaR < 0)) throw new Error("ADR costs must reduce mean R");
if (Math.abs(netCostDeltaR) < 0.03) throw new Error("Synthetic calibration did not expose a measurable cost effect");
