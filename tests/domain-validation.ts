import { assertProbability, assertSignal } from "../src/domain/validation.js";
import type { Signal } from "../src/domain/types.js";

assertProbability(0);
assertProbability(1);

const valid: Signal = {
  signalId: "signal-1" as Signal["signalId"],
  instrumentId: "BTC-USDT-PERP",
  decisionTime: "2026-01-01T00:00:00Z" as Signal["decisionTime"],
  decision: "NO_TRADE",
  side: null,
  regimeId: null,
  setupId: null,
  featureSnapshotIds: [],
  probabilities: [],
  uncertainty: [],
  expectancy: null,
  invalidation: null,
  risk: null,
  liquidity: null,
  vetoReasons: ["liquidity"],
  datasetVersion: "dataset-v1",
  modelVersion: null,
  decisionPolicyVersion: "policy-v1",
};

assertSignal(valid);
