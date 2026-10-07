export interface BinomialEstimate {
  readonly probability: number;
  readonly successes: number;
  readonly observations: number;
  readonly interval: { readonly lower: number; readonly upper: number };
  readonly method: "wilson";
}

export function estimateBinomial(successes: number, observations: number, z = 1.959963984540054): BinomialEstimate {
  if (!Number.isInteger(successes) || !Number.isInteger(observations) || observations <= 0) {
    throw new Error("successes and observations must be positive integers");
  }
  if (successes < 0 || successes > observations) throw new Error("successes must be within observations");
  if (!Number.isFinite(z) || z <= 0) throw new Error("z must be positive and finite");

  const p = successes / observations;
  const z2 = z * z;
  const denominator = 1 + z2 / observations;
  const center = (p + z2 / (2 * observations)) / denominator;
  const margin = z / denominator * Math.sqrt((p * (1 - p) + z2 / (4 * observations)) / observations);

  return {
    probability: p,
    successes,
    observations,
    interval: {
      lower: Math.max(0, center - margin),
      upper: Math.min(1, center + margin),
    },
    method: "wilson",
  };
}

export function expectedValue(probabilities: readonly number[], payoffs: readonly number[]): number {
  if (probabilities.length !== payoffs.length || probabilities.length === 0) {
    throw new Error("Probabilities and payoffs must have equal non-zero length");
  }
  const total = probabilities.reduce((sum, p) => sum + p, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error("Expected value requires a declared probability space summing to 1");
  return probabilities.reduce((sum, probability, index) => sum + probability * payoffs[index], 0);
}
