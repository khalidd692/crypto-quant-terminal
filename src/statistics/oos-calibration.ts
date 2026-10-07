import { calibrationReport, type CalibrationReport, type ProbabilityObservation } from "./calibration.js";

export interface TimestampedProbabilityObservation extends ProbabilityObservation {
  readonly eventTime: string;
}

export interface OOSCalibrationReport extends CalibrationReport {
  readonly evaluationStart: string;
  readonly evaluationObservations: number;
  readonly estimatorVersion: "oos-calibration.v1";
}

/**
 * Calibration is an evaluation operation only. It does not fit probabilities.
 * Callers must provide predictions generated without using observations at or
 * after evaluationStart.
 */
export function evaluateOOSCalibration(
  observations: readonly TimestampedProbabilityObservation[],
  evaluationStart: string,
  binCount = 10,
): OOSCalibrationReport {
  const cutoff = Date.parse(evaluationStart);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid evaluationStart");
  const evaluation = observations
    .filter((observation) => Date.parse(observation.eventTime) >= cutoff)
    .map(({ probability, outcome }) => ({ probability, outcome }));
  if (evaluation.length === 0) throw new Error("OOS calibration requires evaluation observations");
  const report = calibrationReport(evaluation, binCount);
  return {
    ...report,
    evaluationStart: new Date(cutoff).toISOString(),
    evaluationObservations: evaluation.length,
    estimatorVersion: "oos-calibration.v1",
  };
}
