import { runResearchLedger } from "../src/research/research-runner.js";
import { calculateResearchMetrics } from "../src/research/metrics.js";
import { serializeObservationLedger, validateObservationLedger } from "../src/research/observation-ledger.js";

function makePoints(multiplier: number) {
  return Array.from({ length: 180 }, (_, i) => {
    const close = 100 + i * 0.2 * multiplier;
    const event = new Date(Date.UTC(2026, 0, 1, i)).toISOString();
    return {
      instrumentId: "TEST",
      eventTime: event as any,
      availableTime: event as any,
      open: close - 0.1,
      high: close + 0.4,
      low: close - 0.4,
      close,
      volume: 1000 + i,
      dataQuality: "complete" as const,
      sourceId: "fixture",
    };
  });
}

const config = {
  lookback: 50,
  horizonCandles: 8,
  targetR: 1.5,
  invalidationR: 1,
  feeRate: 0.0004,
  slippageRate: 0.0002,
  dataVersion: "fixture-v1",
  featureVersionPolicy: "core-v1",
};

const points = makePoints(1);
const ledger = runResearchLedger(points, config);
const integrity = validateObservationLedger(ledger);
if (integrity.observations !== ledger.length) throw new Error("Ledger count mismatch");
if (integrity.uniqueObservationIds !== ledger.length) throw new Error("Observation IDs are not unique");
if (!integrity.ordered) throw new Error("Ledger must be chronologically ordered");
if (!ledger.every((o) => o.observationId.startsWith("obs_"))) throw new Error("Invalid observation ID");

const serializedA = serializeObservationLedger(ledger);
const serializedB = serializeObservationLedger([...ledger].reverse());
if (serializedA !== serializedB) throw new Error("Ledger serialization is not deterministic");

const metrics = calculateResearchMetrics(ledger);
if (metrics.totalObservations !== ledger.length) throw new Error("Metrics count mismatch");
if (metrics.eligibleObservations > metrics.totalObservations) throw new Error("Eligible count invalid");
if (metrics.targetProbability && (metrics.targetProbability.probability < 0 || metrics.targetProbability.probability > 1)) {
  throw new Error("Target probability outside [0,1]");
}

// Point-in-time invariant: changing only future candles must not change any T0 feature snapshot.
const mutated = makePoints(1);
for (let i = 100; i < mutated.length; i += 1) {
  const p = mutated[i];
  if (!p) continue;
  (mutated as any)[i] = { ...p, high: p.high * 5, low: p.low * 0.2, close: p.close * 3 };
}
const ledgerMutated = runResearchLedger(mutated, config);
const comparable = Math.min(100, ledger.length, ledgerMutated.length);
for (let i = 0; i < comparable; i += 1) {
  const a = ledger[i];
  const b = ledgerMutated[i];
  if (!a || !b) continue;
  if (a.eventTime !== b.eventTime) throw new Error("T0 ordering changed");
  if (JSON.stringify(a.featureSnapshot) !== JSON.stringify(b.featureSnapshot)) {
    throw new Error("Future data leaked into T0 features");
  }
}
