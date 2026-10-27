import { fetchJson } from "./http.js";
import { provenance, unavailableProvenance } from "./common.js";
import type { ContextProvenance } from "../types.js";

const SOURCE = "https://api.alternative.me/fng/?limit=1&format=json";

type FearGreedResponse = {
  data?: Array<{
    value?: unknown;
    timestamp?: unknown;
    value_classification?: unknown;
  }>;
};

export async function fetchSentimentContext(at: string): Promise<{
  score: number | null;
  provenance: ContextProvenance;
}> {
  try {
    const raw = await fetchJson(SOURCE) as FearGreedResponse;
    const item = raw?.data?.[0];
    const score = typeof item?.value === "string" || typeof item?.value === "number"
      ? Number(item.value)
      : NaN;
    const timestamp = typeof item?.timestamp === "string" || typeof item?.timestamp === "number"
      ? Number(item.timestamp)
      : NaN;
    const observedAt = new Date(timestamp * 1000);
    const now = Date.parse(at);

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      !Number.isFinite(observedAt.getTime()) ||
      !Number.isFinite(now) ||
      observedAt.getTime() > now
    ) {
      throw new Error("FEAR_GREED_INVALID_OR_FUTURE_OBSERVATION");
    }

    return {
      score,
      provenance: provenance("market.sentimentScore", SOURCE, at, raw),
    };
  } catch (error) {
    return {
      score: null,
      provenance: unavailableProvenance("market.sentimentScore", SOURCE, at, String(error)),
    };
  }
}
