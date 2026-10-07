import type { ResearchObservation } from "../research/observation-ledger.js";

export interface FinalHoldoutConfig {
  readonly start: string;
  readonly end: string;
  readonly modelVersion: string;
  readonly modelTrainingEnd: string;
}

export interface FinalHoldoutPrediction {
  readonly observationId: string;
  readonly eventTime: string;
  readonly probability: number;
  readonly targetBeforeInvalidation: boolean | null;
  readonly evaluable: boolean;
}

export interface FinalHoldoutResult {
  readonly modelVersion: string;
  readonly modelTrainingEnd: string;
  readonly holdoutStart: string;
  readonly holdoutEnd: string;
  readonly predictions: readonly FinalHoldoutPrediction[];
  readonly holdoutObservations: number;
  readonly evaluatedPredictions: number;
  readonly brierScore: number | null;
  readonly logLoss: number | null;
  readonly coverage: number;
  readonly methodologyVersion: "final-holdout.v1";
}

export interface FrozenHoldoutModel {
  readonly version: string;
  readonly predict: (observation: ResearchObservation) => number | null;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp: ${value}`);
  return parsed;
}

function cleanBinaryOutcome(observation: ResearchObservation): boolean | null {
  const outcome = observation.outcome;
  if (!observation.eligible || outcome === null || outcome.intrabarAmbiguous || outcome.timeExit) return null;
  if (outcome.targetHit === outcome.invalidationHit) return null;
  return outcome.targetHit;
}

function metrics(predictions: readonly FinalHoldoutPrediction[]): { readonly brierScore: number | null; readonly logLoss: number | null; readonly evaluated: number } {
  const evaluated = predictions.filter((prediction) => prediction.evaluable && prediction.targetBeforeInvalidation !== null);
  if (!evaluated.length) return { brierScore: null, logLoss: null, evaluated: 0 };
  const epsilon = 1e-15;
  let brierSum = 0;
  let logLossSum = 0;
  for (const prediction of evaluated) {
    const y = prediction.targetBeforeInvalidation ? 1 : 0;
    const probability = Math.min(1 - epsilon, Math.max(epsilon, prediction.probability));
    brierSum += (prediction.probability - y) ** 2;
    logLossSum -= y * Math.log(probability) + (1 - y) * Math.log(1 - probability);
  }
  return {
    brierScore: brierSum / evaluated.length,
    logLoss: logLossSum / evaluated.length,
    evaluated: evaluated.length,
  };
}

/**
 * Evaluates a frozen model on an untouched final holdout.
 * No fitting, feature selection, threshold tuning, or calibration is allowed here.
 *
 * Point-in-time rule: each holdout observation is eligible when its features were
 * available by its own decision/event time. The entire holdout does not need to
 * have been available at the holdout start; otherwise later valid observations
 * would be incorrectly discarded.
 */
export function runFinalHoldout(
  observations: readonly ResearchObservation[],
  config: FinalHoldoutConfig,
  model: FrozenHoldoutModel,
): FinalHoldoutResult {
  const start = timestamp(config.start);
  const end = timestamp(config.end);
  const trainingEnd = timestamp(config.modelTrainingEnd);
  if (!(start < end)) throw new Error("Final holdout interval must be strictly chronological");
  if (trainingEnd > start) throw new Error("Frozen model training must end before final holdout starts");
  if (model.version !== config.modelVersion) throw new Error("Frozen model version mismatch");

  const holdout = observations.filter((observation) => {
    const event = timestamp(observation.eventTime);
    const available = timestamp(observation.availableTime);
    return event >= start && event < end && available <= event;
  });

  const predictions: FinalHoldoutPrediction[] = [];
  for (const observation of holdout) {
    const estimated = model.predict(observation);
    if (estimated === null) continue;
    if (!Number.isFinite(estimated) || estimated < 0 || estimated > 1) {
      throw new Error("Frozen model returned probability outside [0,1]");
    }
    const targetBeforeInvalidation = cleanBinaryOutcome(observation);
    predictions.push({
      observationId: observation.observationId,
      eventTime: observation.eventTime,
      probability: estimated,
      targetBeforeInvalidation,
      evaluable: targetBeforeInvalidation !== null,
    });
  }

  const result = metrics(predictions);
  return {
    modelVersion: config.modelVersion,
    modelTrainingEnd: config.modelTrainingEnd,
    holdoutStart: config.start,
    holdoutEnd: config.end,
    predictions,
    holdoutObservations: holdout.length,
    evaluatedPredictions: result.evaluated,
    brierScore: result.brierScore,
    logLoss: result.logLoss,
    coverage: predictions.length === 0 ? 0 : result.evaluated / predictions.length,
    methodologyVersion: "final-holdout.v1",
  };
}
