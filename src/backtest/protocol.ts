export interface BacktestSplit {
  readonly trainStart: string;
  readonly trainEnd: string;
  readonly validationStart: string;
  readonly validationEnd: string;
  readonly testStart: string;
  readonly testEnd: string;
}

export interface PurgeEmbargoPolicy {
  readonly purgeDurationMs: number;
  readonly embargoDurationMs: number;
  readonly rationale: string;
}

export interface BacktestProtocol {
  readonly split: BacktestSplit;
  readonly purgeEmbargo: PurgeEmbargoPolicy;
  readonly finalHoldoutStart: string;
  readonly costsVersion: string;
  readonly universeVersion: string;
}

export function assertChronologicalProtocol(protocol: BacktestProtocol): void {
  const points = [
    protocol.split.trainStart,
    protocol.split.trainEnd,
    protocol.split.validationStart,
    protocol.split.validationEnd,
    protocol.split.testStart,
    protocol.split.testEnd,
    protocol.finalHoldoutStart,
  ];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i] <= points[i - 1]) throw new Error("Backtest periods must be strictly chronological");
  }
  if (protocol.purgeEmbargo.purgeDurationMs < 0 || protocol.purgeEmbargo.embargoDurationMs < 0) {
    throw new Error("Purge and embargo durations cannot be negative");
  }
  if (!protocol.purgeEmbargo.rationale.trim()) throw new Error("Purge/embargo rationale is required");
}
