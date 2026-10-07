export interface ProbabilityObservation {
  readonly probability: number;
  readonly outcome: 0 | 1;
}

export interface CalibrationBin {
  readonly lowerInclusive: number;
  readonly upperExclusive: number;
  readonly observations: number;
  readonly meanPredicted: number;
  readonly empiricalFrequency: number;
}

export interface CalibrationReport {
  readonly brierScore: number;
  readonly logLoss: number;
  readonly bins: readonly CalibrationBin[];
}

export function calibrationReport(
  observations: readonly ProbabilityObservation[],
  binCount = 10,
): CalibrationReport {
  if (observations.length === 0) throw new Error("Calibration requires observations");
  if (!Number.isInteger(binCount) || binCount <= 0) throw new Error("binCount must be positive");

  for (const observation of observations) {
    if (!Number.isFinite(observation.probability) || observation.probability < 0 || observation.probability > 1) {
      throw new Error("Probability must be within [0,1]");
    }
  }

  const brierScore = observations.reduce(
    (sum, observation) => sum + (observation.probability - observation.outcome) ** 2,
    0,
  ) / observations.length;

  const epsilon = 1e-15;
  const logLoss = -observations.reduce((sum, observation) => {
    const p = Math.min(1 - epsilon, Math.max(epsilon, observation.probability));
    return sum + observation.outcome * Math.log(p) + (1 - observation.outcome) * Math.log(1 - p);
  }, 0) / observations.length;

  const bins: CalibrationBin[] = [];
  for (let i = 0; i < binCount; i += 1) {
    const lower = i / binCount;
    const upper = i === binCount - 1 ? 1 + epsilon : (i + 1) / binCount;
    const subset = observations.filter((observation) => observation.probability >= lower && observation.probability < upper);
    if (subset.length === 0) continue;
    bins.push({
      lowerInclusive: lower,
      upperExclusive: Math.min(1, upper),
      observations: subset.length,
      meanPredicted: subset.reduce((sum, item) => sum + item.probability, 0) / subset.length,
      empiricalFrequency: subset.reduce((sum, item) => sum + item.outcome, 0) / subset.length,
    });
  }

  return { brierScore, logLoss, bins };
}
