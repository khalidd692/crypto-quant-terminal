export interface SimpleReturnSummary {
  readonly count: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly sum: number;
  readonly positiveFraction: number | null;
  readonly max: number | null;
  readonly min: number | null;
}

export interface SimpleDrawdownSummary {
  readonly maxDrawdownR: number;
  readonly maxDrawdownFraction: number;
}

export function summarizeReturns(values: readonly number[]): SimpleReturnSummary {
  if (!values.length) return { count: 0, mean: null, median: null, sum: 0, positiveFraction: null, max: null, min: null };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: values.length,
    mean: sum / values.length,
    median: sorted.length % 2 ? sorted[middle]! : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2,
    sum,
    positiveFraction: values.filter((v) => v > 0).length / values.length,
    max: sorted.at(-1) ?? null,
    min: sorted[0] ?? null,
  };
}

export function summarizeDrawdown(values: readonly number[]): SimpleDrawdownSummary {
  let equity = 1;
  let peak = 1;
  let maxDrawdownR = 0;
  let maxDrawdownFraction = 0;
  for (const value of values) {
    equity += value;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < maxDrawdownR) {
      maxDrawdownR = drawdown;
      maxDrawdownFraction = Math.abs(drawdown) / peak;
    }
  }
  return { maxDrawdownR, maxDrawdownFraction };
}
