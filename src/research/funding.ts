import type { Side } from "../domain/types.js";
import type { BinanceFundingRate } from "../adapters/binance/public-client.js";

export interface FundingAssessment {
  readonly paymentReturnFraction: number;
  readonly eventsApplied: number;
  readonly eventTimes: readonly string[];
  readonly methodologyVersion: string;
}

/**
 * Funding is treated as a cash-flow on notional. Positive funding means
 * longs pay and shorts receive; negative funding reverses that transfer.
 * Only funding timestamps strictly after entry and at/before exit are applied.
 */
export function assessFunding(
  side: Side,
  entryEventTime: string,
  exitEventTime: string,
  rates: readonly BinanceFundingRate[],
): FundingAssessment {
  const entry = Date.parse(entryEventTime);
  const exit = Date.parse(exitEventTime);
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry > exit) throw new Error("Invalid funding holding interval");

  let paymentReturnFraction = 0;
  const eventTimes: string[] = [];
  for (const rate of rates) {
    const fundingTime = Date.parse(rate.fundingTime);
    if (!Number.isFinite(fundingTime) || fundingTime <= entry || fundingTime > exit) continue;
    paymentReturnFraction += side === "LONG" ? -rate.fundingRate : rate.fundingRate;
    eventTimes.push(rate.fundingTime);
  }

  return {
    paymentReturnFraction,
    eventsApplied: eventTimes.length,
    eventTimes,
    methodologyVersion: "funding-cashflow.v1",
  };
}
