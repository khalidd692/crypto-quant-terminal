import type { Signal } from "../domain/types.js";
import { computeCoreFeatures, requireFeatureHistory } from "../features/feature-engine.js";
import { classifyBasicRegime } from "../regime/classifier.js";
import { assessBasicTrendSetup } from "../setup/basic.js";
import { decide } from "../decision/engine.js";
import type { MarketDataPoint } from "../domain/types.js";

export interface TerminalEvaluation {
  readonly signal: Signal;
  readonly featureCount: number;
  readonly regime: string;
  readonly setup: string;
}

export function evaluateReadOnly(
  instrumentId: string,
  points: readonly MarketDataPoint[],
  dataVersion: string,
  decisionTime: string,
): TerminalEvaluation {
  requireFeatureHistory(points, 50);
  const last = points.at(-1);
  if (!last) throw new Error("No market data");

  const features = computeCoreFeatures({
    instrumentId,
    eventTime: last.eventTime,
    availableTime: last.availableTime,
    dataVersion,
    points,
  });
  const regime = classifyBasicRegime({ instrumentId, eventTime: last.eventTime, featureSnapshots: features, version: "basic-regime-v1" });
  const setup = assessBasicTrendSetup(features);
  const decision = decide({
    directionalSide: setup.side,
    evidenceSufficient: false,
    expectancy: null,
    minExpectedValue: 0,
    liquidity: null,
    risk: null,
    vetoReasons: [],
  });

  const signal: Signal = {
    signalId: `signal:${instrumentId}:${decisionTime}` as Signal["signalId"],
    instrumentId,
    decisionTime: decisionTime as Signal["decisionTime"],
    decision: decision.decision,
    side: decision.side,
    regimeId: regime.regimeId,
    setupId: setup.setupId,
    featureSnapshotIds: features.map((feature, index) => `${feature.featureId}:${index}` as Signal["featureSnapshotIds"][number]),
    probabilities: [],
    uncertainty: [],
    expectancy: null,
    invalidation: null,
    risk: null,
    liquidity: null,
    vetoReasons: decision.reasons,
    datasetVersion: dataVersion,
    modelVersion: null,
    decisionPolicyVersion: "decision-policy-v1",
  };
  return { signal, featureCount: features.length, regime: regime.label, setup: setup.valid ? setup.setupId : "NONE" };
}
