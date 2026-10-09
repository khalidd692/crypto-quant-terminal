export interface MexcTelDerivativesResult {
  readonly fundingRate: number | null;
  readonly openInterestQuote: number | null;
  readonly fundingReason: string | null;
  readonly openInterestReason: string | null;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function responseData(value: unknown): UnknownRecord | null {
  const envelope = record(value);
  if (!envelope || envelope.success !== true || Number(envelope.code) !== 0) return null;
  const data = envelope.data;
  if (Array.isArray(data)) {
    const found = data.map(record).find((item) => item?.symbol === "TEL_USDT");
    return found ?? null;
  }
  const item = record(data);
  return item?.symbol === "TEL_USDT" ? item : null;
}

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function freshTimestamp(value: unknown, now: string, maxAgeMs: number): boolean {
  let timestamp = finite(value);
  const nowMs = Date.parse(now);
  if (timestamp === null || !Number.isFinite(nowMs) || timestamp <= 0) return false;
  if (timestamp < 1_000_000_000_000) timestamp *= 1000;
  const age = nowMs - timestamp;
  return age >= -5 * 60_000 && age <= maxAgeMs;
}

/** Normalize documented public MEXC TEL_USDT perpetual fields; never infer missing values. */
export function normalizeMexcTelDerivatives(input: {
  readonly funding: unknown;
  readonly ticker: unknown;
  readonly contract: unknown;
  readonly now: string;
  readonly fundingError?: string | null;
  readonly tickerError?: string | null;
  readonly contractError?: string | null;
  readonly maxAgeMs?: number;
}): MexcTelDerivativesResult {
  const maxAgeMs = input.maxAgeMs ?? 15 * 60_000;
  const fundingData = responseData(input.funding);
  const tickerData = responseData(input.ticker);
  const contractData = responseData(input.contract);

  let fundingRate: number | null = null;
  let fundingReason: string | null = null;
  if (!fundingData) fundingReason = input.fundingError ?? "MEXC_TEL_FUNDING_SCHEMA_OR_SYMBOL_INVALID";
  else {
    const rate = finite(fundingData.fundingRate);
    if (rate === null) fundingReason = "MEXC_TEL_FUNDING_RATE_INVALID";
    else if (!freshTimestamp(fundingData.timestamp, input.now, maxAgeMs)) fundingReason = "MEXC_TEL_FUNDING_STALE_OR_FUTURE";
    else fundingRate = rate;
  }

  let openInterestQuote: number | null = null;
  let openInterestReason: string | null = null;
  if (!tickerData) openInterestReason = input.tickerError ?? "MEXC_TEL_TICKER_SCHEMA_OR_SYMBOL_INVALID";
  else if (!freshTimestamp(tickerData.timestamp, input.now, maxAgeMs)) openInterestReason = "MEXC_TEL_TICKER_STALE_OR_FUTURE";
  else if (!contractData) openInterestReason = input.contractError ?? "MEXC_TEL_CONTRACT_DETAIL_SCHEMA_OR_SYMBOL_INVALID";
  else {
    const holdVol = finite(tickerData.holdVol);
    const fairPrice = finite(tickerData.fairPrice);
    const contractSize = finite(contractData.contractSize);
    if (holdVol === null || holdVol < 0 || fairPrice === null || fairPrice <= 0 || contractSize === null || contractSize <= 0) {
      openInterestReason = "MEXC_TEL_OPEN_INTEREST_INPUT_INVALID";
    } else {
      const quoteValue = holdVol * contractSize * fairPrice;
      if (Number.isFinite(quoteValue) && quoteValue >= 0) openInterestQuote = quoteValue;
      else openInterestReason = "MEXC_TEL_OPEN_INTEREST_CALCULATION_INVALID";
    }
  }
  return { fundingRate, openInterestQuote, fundingReason, openInterestReason };
}
