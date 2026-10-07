import { createHash } from "node:crypto";
import type { DatasetVersion, MarketDataPoint } from "../domain/types.js";
import { validateMarketDataSeries } from "../domain/gaps.js";
import { BinancePublicClient, type BinanceMarket } from "../adapters/binance/public-client.js";
import { createDatasetVersion } from "./dataset.js";
import { runResearchLedger, type ResearchRunnerConfig } from "./research-runner.js";
import { serializeObservationLedger, type ResearchObservation } from "./observation-ledger.js";

export interface HistoricalKlineSource {
  historicalKlines(
    symbol: string,
    interval: string,
    startTimeMs: number,
    endTimeMs: number,
    options?: { readonly pageDelayMs?: number; readonly maxPages?: number },
  ): Promise<MarketDataPoint[]>;
}

export interface HistoricalResearchConfig extends ResearchRunnerConfig {
  readonly market: BinanceMarket;
  readonly symbol: string;
  readonly interval: string;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly expectedIntervalMs: number;
  readonly methodologyVersion: string;
  readonly availabilityLagMs?: number;
  readonly pageDelayMs?: number;
  readonly maxPages?: number;
  readonly rejectGaps?: boolean;
}

export interface ResearchDatasetManifest {
  readonly artifactVersion: string;
  readonly artifactHash: string;
  readonly datasetVersion: DatasetVersion;
  readonly instrumentId: string;
  readonly market: BinanceMarket;
  readonly interval: string;
  readonly pointCount: number;
  readonly observationCount: number;
  readonly eligibleObservationCount: number;
  readonly integrity: ReturnType<typeof validateMarketDataSeries>;
  readonly config: Readonly<Record<string, string | number | boolean>>;
}

export interface HistoricalResearchDataset {
  readonly points: readonly MarketDataPoint[];
  readonly observations: readonly ResearchObservation[];
  readonly manifest: ResearchDatasetManifest;
  readonly observationsJsonl: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
    .join(",") + "}";
}

export async function buildHistoricalResearchDataset(
  config: HistoricalResearchConfig,
  client: HistoricalKlineSource = new BinancePublicClient({
    market: config.market,
    availabilityLagMs: config.availabilityLagMs,
  }),
): Promise<HistoricalResearchDataset> {
  const points = await client.historicalKlines(
    config.symbol,
    config.interval,
    config.startTimeMs,
    config.endTimeMs,
    { pageDelayMs: config.pageDelayMs, maxPages: config.maxPages },
  );

  const integrity = validateMarketDataSeries(points, config.expectedIntervalMs);
  if (!integrity.valid) {
    const reasons = [
      integrity.duplicateEventTimes > 0 ? "duplicate timestamps" : null,
      integrity.invalidRows > 0 ? "invalid OHLC/volume rows" : null,
      integrity.nonMonotonicRows > 0 ? "non-monotonic timestamps" : null,
      integrity.gaps.length > 0 ? "time gaps" : null,
    ].filter((value): value is string => value !== null);
    if (config.rejectGaps !== false || reasons.some((reason) => reason !== "time gaps")) {
      throw new Error("Research dataset rejected: " + reasons.join(", "));
    }
  }

  if (points.length === 0) throw new Error("Historical source returned no usable candles");

  const sourceIds = [...new Set(points.map((point) => point.sourceId))].sort();
  const datasetVersion = createDatasetVersion(
    points,
    sourceIds,
    config.methodologyVersion,
    new Date().toISOString(),
  );

  const observations = runResearchLedger(points, {
    ...config,
    dataVersion: datasetVersion.datasetVersion,
  });
  const observationsJsonl = serializeObservationLedger(observations);

  const manifestConfig = {
    lookback: config.lookback,
    horizonCandles: config.horizonCandles,
    targetR: config.targetR,
    invalidationR: config.invalidationR,
    feeRate: config.feeRate,
    slippageRate: config.slippageRate,
    featureVersionPolicy: config.featureVersionPolicy,
    methodologyVersion: config.methodologyVersion,
    rejectGaps: config.rejectGaps !== false,
  };
  const manifestPayload = {
    datasetVersion,
    instrumentId: config.symbol,
    market: config.market,
    interval: config.interval,
    pointCount: points.length,
    observationCount: observations.length,
    eligibleObservationCount: observations.filter((observation) => observation.eligible).length,
    integrity,
    config: manifestConfig,
    observationsJsonl,
  };
  const artifactHash = createHash("sha256").update(canonical(manifestPayload)).digest("hex");

  return {
    points,
    observations,
    observationsJsonl,
    manifest: {
      artifactVersion: "research-dataset.v1",
      artifactHash: "sha256:" + artifactHash,
      datasetVersion,
      instrumentId: config.symbol,
      market: config.market,
      interval: config.interval,
      pointCount: points.length,
      observationCount: observations.length,
      eligibleObservationCount: observations.filter((observation) => observation.eligible).length,
      integrity,
      config: manifestConfig,
    },
  };
}
