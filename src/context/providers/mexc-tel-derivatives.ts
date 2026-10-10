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

function activeTelContract(value: UnknownRecord | null): boolean {
  // MEXC's documented public /contract/detail schema provides quoteCoin,
  // settleCoin and contractSize, but does not document a contract state field.
  // Confirm listing via the complete detail list and validate the documented
  // USDT quote/settlement fields instead of requiring an undocumented field.
  const contractSize = finite(value?.contractSize);
  return value !== null
    && value.symbol === "TEL_USDT"
    && value.quoteCoin === "USDT"
    && value.settleCoin === "USDT"
    && contractSize !== null
    && contractSize > 0;
}

function contractEligibilityReason(value: UnknownRecord | null): string {
  if (!value || value.symbol !== "TEL_USDT") return "MEXC_TEL_PERP_NOT_LISTED";
  if (value.quoteCoin !== "USDT" || value.settleCoin !== "USDT") return "MEXC_TEL_PERP_NOT_USDT_SETTLED";
  if (finite(value.contractSize) === null || finite(value.contractSize)! <= 0) return "MEXC_TEL_CONTRACT_SIZE_INVALID";
  return "MEXC_TEL_PERP_NOT_CONFIRMED";
}

function responseFailure(value: unknown, prefix: string): string {
  const envelope = record(value);
  if (!envelope) return prefix + "_INVALID_ENVELOPE";
  if (envelope.success !== true || Number(envelope.code) !== 0) {
    return prefix + "_API_ERROR (code=" + String(envelope.code) + ")";
  }
  const data = envelope.data;
  if (Array.isArray(data)) {
    const symbols = data.map(record).map(item => item?.symbol).filter((symbol): symbol is string => typeof symbol === "string");
    if (!symbols.includes("TEL_USDT")) return prefix + "_SYMBOL_ABSENT (symbols=" + (symbols.slice(0, 5).join(",") || "none") + ")";
    return prefix + "_INVALID_DATA";
  }
  const item = record(data);
  if (!item) return prefix + "_DATA_MISSING";
  if (item.symbol !== "TEL_USDT") return prefix + "_SYMBOL_MISMATCH (received=" + String(item.symbol ?? "missing") + ")";
  return prefix + "_INVALID_DATA";
}

function finite(value: unknown): number | null {
  // Match numberOrNull semantics: missing/null/blank values are not numeric zero.
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
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
  // Funding is not treated as live unless the official contract-detail list
  // independently confirms a TEL_USDT USDT-settled contract.
  if (!contractData) {
    const contractEnvelope = record(input.contract);
    const contractCode = contractEnvelope?.code;
    const contractDataRaw = contractEnvelope?.data;
    const contractListConfirmsAbsence = contractEnvelope?.success === true
      && Number(contractCode) === 0
      && Array.isArray(contractDataRaw)
      && !contractDataRaw.some((item) => record(item)?.symbol === "TEL_USDT");
    const contractNotListed = (contractEnvelope?.success === false && Number(contractCode) === 1001)
      || contractListConfirmsAbsence;
    fundingReason = contractNotListed
      ? "MEXC_TEL_PERP_NOT_LISTED"
      : input.contractError ?? responseFailure(input.contract, "MEXC_TEL_CONTRACT_DETAIL");
  } else if (!activeTelContract(contractData)) {
    fundingReason = contractEligibilityReason(contractData);
  } else if (!fundingData) fundingReason = input.fundingError ?? responseFailure(input.funding, "MEXC_TEL_FUNDING");
  else {
    const rate = finite(fundingData.fundingRate);
    if (rate === null) fundingReason = "MEXC_TEL_FUNDING_RATE_INVALID";
    else if (!freshTimestamp(fundingData.timestamp, input.now, maxAgeMs)) fundingReason = "MEXC_TEL_FUNDING_STALE_OR_FUTURE";
    else fundingRate = rate;
  }

  let openInterestQuote: number | null = null;
  let openInterestReason: string | null = null;
  if (!tickerData) openInterestReason = input.tickerError ?? responseFailure(input.ticker, "MEXC_TEL_TICKER");
  else if (!freshTimestamp(tickerData.timestamp, input.now, maxAgeMs)) openInterestReason = "MEXC_TEL_TICKER_STALE_OR_FUTURE";
  else if (!contractData) openInterestReason = input.contractError ?? responseFailure(input.contract, "MEXC_TEL_CONTRACT_DETAIL");
  else if (!activeTelContract(contractData)) openInterestReason = contractEligibilityReason(contractData);
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
