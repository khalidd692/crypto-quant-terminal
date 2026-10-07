import type { FeatureSnapshot, MarketDataPoint, Side } from "../domain/types.js";
import { createHash } from "node:crypto";

export type OutcomeLabel = "TARGET" | "INVALIDATION" | "TIME_EXIT" | "AMBIGUOUS";

export interface ResearchOutcome {
  readonly label: OutcomeLabel;
  readonly targetHit: boolean;
  readonly invalidationHit: boolean;
  readonly timeExit: boolean;
  readonly intrabarAmbiguous: boolean;
  readonly mfeR: number;
  readonly maeR: number;
  readonly realizedR: number;
  readonly returnFraction: number;
  readonly exitPrice: number;
  readonly exitEventTime: string;
  readonly feesReturn: number;
  readonly slippageReturn: number;
  readonly fundingReturn: number;
}

export interface ResearchObservation {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly eventTime: string;
  readonly availableTime: string;
  readonly datasetVersion: string;
  readonly featureDefinitionVersions: readonly string[];
  readonly featureSnapshot: readonly FeatureSnapshot[];
  readonly setupId: string | null;
  readonly side: Side | null;
  readonly entryReferencePrice: number;
  readonly horizonCandles: number;
  readonly horizonEndTime: string | null;
  readonly targetR: number | null;
  readonly invalidationR: number | null;
  readonly outcome: ResearchOutcome | null;
  readonly eligible: boolean;
  readonly exclusionReason: string | null;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

function idFor(value: Omit<ResearchObservation, "observationId">): string {
  return `obs_${createHash("sha256").update(canonical(value)).digest("hex").slice(0, 32)}`;
}

export function createResearchObservation(
  input: Omit<ResearchObservation, "observationId">,
): ResearchObservation {
  const observation = { ...input } as Omit<ResearchObservation, "observationId">;
  return { ...observation, observationId: idFor(observation) };
}

export interface LedgerIntegrity {
  readonly observations: number;
  readonly uniqueObservationIds: number;
  readonly ordered: boolean;
  readonly duplicateEventTimes: number;
}

export function validateObservationLedger(observations: readonly ResearchObservation[]): LedgerIntegrity {
  const ids = new Set(observations.map((o) => o.observationId));
  let ordered = true;
  let duplicateEventTimes = 0;
  const seenTimes = new Set<string>();
  for (let i = 1; i < observations.length; i += 1) {
    const previous = observations[i - 1];
    const current = observations[i];
    if (!previous || !current) continue;
    if (current.eventTime < previous.eventTime) ordered = false;
  }
  for (const observation of observations) {
    if (seenTimes.has(observation.eventTime)) duplicateEventTimes += 1;
    seenTimes.add(observation.eventTime);
  }
  return {
    observations: observations.length,
    uniqueObservationIds: ids.size,
    ordered,
    duplicateEventTimes,
  };
}

export function serializeObservationLedger(observations: readonly ResearchObservation[]): string {
  const ordered = [...observations].sort((a, b) =>
    a.eventTime.localeCompare(b.eventTime) || a.observationId.localeCompare(b.observationId),
  );
  return ordered.map((observation) => canonical(observation)).join("\n") + (ordered.length ? "\n" : "");
}
