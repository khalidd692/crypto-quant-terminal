import type { ResearchObservation } from "../research/observation-ledger.js";
import { splitObservations } from "./purged-split.js";
import type { WalkForwardConfig, WalkForwardWindow } from "./walk-forward.js";
import { buildWalkForwardWindows } from "./walk-forward.js";

export interface OOSPrediction {
  readonly windowId: string;
  readonly observationId: string;
  readonly eventTime: string;
  readonly trainingEnd: string;
  readonly probability: number;
  readonly estimatorVersion: string;
  readonly trainingObservationCount: number;
  readonly targetBeforeInvalidation: boolean | null;
  readonly evaluable: boolean;
}

export interface WalkForwardWindowResult {
  readonly window: WalkForwardWindow;
  readonly trainingObservations: number;
  readonly purgedObservations: number;
  readonly embargoedObservations: number;
  readonly testObservations: number;
  readonly predictions: readonly OOSPrediction[];
}

export interface WalkForwardResult {
  readonly windows: readonly WalkForwardWindowResult[];
  readonly predictions: readonly OOSPrediction[];
  readonly evaluatedPredictions: number;
  readonly brierScore: number | null;
  readonly logLoss: number | null;
  readonly coverage: number;
  readonly methodologyVersion: "walk-forward-oos.v1";
}

export interface WalkForwardEstimator {
  readonly version: string;
  estimate(
    training: readonly ResearchObservation[],
    observation: ResearchObservation,
  ): number | null;
}

function finiteProbability(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Estimator returned a probability outside [0,1]");
  }
  return value;
}

function cleanBinaryOutcome(observation: ResearchObservation): boolean | null {
  const outcome = observation.outcome;
  if (!observation.eligible || outcome === null || outcome.intrabarAmbiguous || outcome.timeExit) return null;
  if (outcome.targetHit === outcome.invalidationHit) return null;
  return outcome.targetHit;
}

function brier(predictions: readonly OOSPrediction[]): number | null {
  const evaluated = predictions.filter((p) => p.evaluable && p.targetBeforeInvalidation !== null);
  if (!evaluated.length) return null;
  return evaluated.reduce((sum, p) => {
    const y = p.targetBeforeInvalidation ? 1 : 0;
    return sum + (p.probability - y) ** 2;
  }, 0) / evaluated.length;
}

function logLoss(predictions: readonly OOSPrediction[]): number | null {
  const evaluated = predictions.filter((p) => p.evaluable && p.targetBeforeInvalidation !== null);
  if (!evaluated.length) return null;
  const epsilon = 1e-15;
  return evaluated.reduce((sum, p) => {
    const y = p.targetBeforeInvalidation ? 1 : 0;
    const probability = Math.min(1 - epsilon, Math.max(epsilon, p.probability));
    return sum - (y * Math.log(probability) + (1 - y) * Math.log(1 - probability));
  }, 0) / evaluated.length;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp: ${value}`);
  return parsed;
}

/**
 * Executes a strictly chronological OOS walk-forward loop.
 *
 * Training is bounded by BOTH eventTime and availableTime. Labels whose horizon
 * reaches the test interval are purged. The estimator is fitted independently
 * for every window; no test observation is exposed during estimation.
 */
export function runWalkForwardOOS(
  observations: readonly ResearchObservation[],
  config: WalkForwardConfig,
  estimator: WalkForwardEstimator,
): WalkForwardResult {
  const windows = buildWalkForwardWindows(config);
  const results: WalkForwardWindowResult[] = [];

  for (const window of windows) {
    const split = splitObservations(observations, {
      trainEnd: window.trainEnd,
      testStart: window.testStart,
      testEnd: window.testEnd,
      embargoDurationMs: config.embargoDurationMs,
      rationale: "Outcome horizons must not overlap the OOS test interval.",
    });

    const train = split.train.filter((observation) =>
      timestamp(observation.eventTime) < timestamp(window.trainEnd) &&
      timestamp(observation.availableTime) <= timestamp(window.trainEnd),
    );

    const predictions: OOSPrediction[] = [];
    for (const observation of split.test) {
      if (timestamp(observation.availableTime) > timestamp(observation.eventTime)) {
        // This is expected for historical bars; the test observation itself is
        // only a valid decision point when its snapshot was available by T0.
      }
      const estimated = estimator.estimate(train, observation);
      if (estimated === null) continue;
      const probability = finiteProbability(estimated);
      const targetBeforeInvalidation = cleanBinaryOutcome(observation);
      predictions.push({
        windowId: window.id,
        observationId: observation.observationId,
        eventTime: observation.eventTime,
        trainingEnd: window.trainEnd,
        probability,
        estimatorVersion: estimator.version,
        trainingObservationCount: train.length,
        targetBeforeInvalidation,
        evaluable: targetBeforeInvalidation !== null,
      });
    }

    results.push({
      window,
      trainingObservations: train.length,
      purgedObservations: split.purged.length,
      embargoedObservations: split.embargoed.length,
      testObservations: split.test.length,
      predictions,
    });
  }

  const predictions = results.flatMap((result) => result.predictions);
  const evaluatedPredictions = predictions.filter((prediction) => prediction.evaluable).length;
  return {
    windows: results,
    predictions,
    evaluatedPredictions,
    brierScore: brier(predictions),
    logLoss: logLoss(predictions),
    coverage: predictions.length === 0 ? 0 : evaluatedPredictions / predictions.length,
    methodologyVersion: "walk-forward-oos.v1",
  };
}
