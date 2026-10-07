import type { DatasetVersion, ISO8601, MarketDataPoint } from "./types.js";

export interface DataValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly eventTime?: ISO8601;
}

export interface DataValidationReport {
  readonly valid: boolean;
  readonly issues: readonly DataValidationIssue[];
  readonly checked: number;
}

function finite(name: string, value: number, issues: DataValidationIssue[], time: ISO8601): void {
  if (!Number.isFinite(value)) issues.push({ code: "NON_FINITE", message: `${name} must be finite`, eventTime: time });
}

export function validateMarketData(points: readonly MarketDataPoint[]): DataValidationReport {
  const issues: DataValidationIssue[] = [];
  let previous: ISO8601 | null = null;

  for (const point of points) {
    finite("open", point.open, issues, point.eventTime);
    finite("high", point.high, issues, point.eventTime);
    finite("low", point.low, issues, point.eventTime);
    finite("close", point.close, issues, point.eventTime);
    finite("volume", point.volume, issues, point.eventTime);

    if (point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0) {
      issues.push({ code: "NON_POSITIVE_PRICE", message: "OHLC prices must be positive", eventTime: point.eventTime });
    }
    if (point.volume < 0) {
      issues.push({ code: "NEGATIVE_VOLUME", message: "Volume cannot be negative", eventTime: point.eventTime });
    }
    if (point.high < Math.max(point.open, point.close) || point.high < point.low) {
      issues.push({ code: "INVALID_HIGH", message: "High is inconsistent with OHLC", eventTime: point.eventTime });
    }
    if (point.low > Math.min(point.open, point.close) || point.low > point.high) {
      issues.push({ code: "INVALID_LOW", message: "Low is inconsistent with OHLC", eventTime: point.eventTime });
    }
    if (point.availableTime < point.eventTime) {
      issues.push({ code: "AVAILABILITY_BEFORE_EVENT", message: "availableTime cannot precede eventTime", eventTime: point.eventTime });
    }
    if (previous !== null && point.eventTime <= previous) {
      issues.push({ code: "NON_MONOTONIC_TIME", message: "Market data must be strictly ordered by eventTime", eventTime: point.eventTime });
    }
    previous = point.eventTime;
  }

  return { valid: issues.length === 0, issues, checked: points.length };
}

export function validateDatasetVersion(dataset: DatasetVersion): void {
  if (!dataset.immutable) throw new Error("Dataset versions must be immutable");
  if (dataset.sourceIds.length === 0) throw new Error("Dataset version requires at least one source");
  if (dataset.coverageEnd <= dataset.coverageStart) throw new Error("Dataset coverageEnd must exceed coverageStart");
}
