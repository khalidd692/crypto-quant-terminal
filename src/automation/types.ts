export interface AutomationAssetConfig {
  readonly assetId: string;
  readonly symbol: string;
  readonly venue: "BINANCE_SPOT" | "KUCOIN_SPOT";
  readonly enabled: boolean;
  readonly maxAgeMs: number;
  readonly maxSpreadBps: number;
  readonly alertMovePct24h: number;
}

export interface AutomationConfig {
  readonly schemaVersion: "automation-config.v1";
  readonly pollIntervalMinutes: number;
  readonly assets: readonly AutomationAssetConfig[];
  readonly alertWebhookConfigured: boolean;
}

export interface ProspectiveObservation {
  readonly runId: string;
  readonly observedAt: string;
  readonly assetId: string;
  readonly symbol: string;
  readonly venue: AutomationAssetConfig["venue"];
  readonly price: number | null;
  readonly return24hPct: number | null;
  readonly spreadBps: number | null;
  readonly dataAvailable: boolean;
  readonly dataFresh: boolean;
  readonly alerts: readonly string[];
}

export interface AutomationRun {
  readonly schemaVersion: "automation-run.v1";
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly observations: readonly ProspectiveObservation[];
  readonly alertCount: number;
}
