export interface MeanBootstrapInterval {
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
  readonly confidenceLevel: number;
  readonly blockSize: number;
  readonly resamples: number;
  readonly method: "moving-block-bootstrap";
}

function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) throw new Error("Cannot compute quantile of empty sample");
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function movingBlockBootstrapMean(
  values: readonly number[],
  options: {
    readonly blockSize: number;
    readonly resamples: number;
    readonly confidenceLevel?: number;
    readonly seed?: number;
  },
): MeanBootstrapInterval | null {
  if (!values.length) return null;
  if (!Number.isInteger(options.blockSize) || options.blockSize < 1 || options.blockSize > values.length) {
    throw new Error("blockSize must be between 1 and sample size");
  }
  if (!Number.isInteger(options.resamples) || options.resamples < 100) throw new Error("resamples must be >= 100");
  const confidenceLevel = options.confidenceLevel ?? 0.95;
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) throw new Error("confidenceLevel must be in (0,1)");

  const random = seededRandom(options.seed ?? 0x51f15e);
  const sampleMean = values.reduce((a, b) => a + b, 0) / values.length;
  const means: number[] = [];

  for (let r = 0; r < options.resamples; r += 1) {
    const sample: number[] = [];
    while (sample.length < values.length) {
      const start = Math.floor(random() * (values.length - options.blockSize + 1));
      for (let j = 0; j < options.blockSize && sample.length < values.length; j += 1) {
        sample.push(values[start + j]!);
      }
    }
    means.push(sample.reduce((a, b) => a + b, 0) / sample.length);
  }

  means.sort((a, b) => a - b);
  const alpha = 1 - confidenceLevel;
  return {
    estimate: sampleMean,
    lower: quantile(means, alpha / 2),
    upper: quantile(means, 1 - alpha / 2),
    confidenceLevel,
    blockSize: options.blockSize,
    resamples: options.resamples,
    method: "moving-block-bootstrap",
  };
}
