import type { OutcomeLabel } from "../research/observation-ledger.js";
import type { ResearchObservation } from "../research/observation-ledger.js";
import { estimateBinomial, type BinomialEstimate } from "./binomial.js";

export type EmpiricalOutcomeEvent = OutcomeLabel;

export interface OutcomeProbability {
  readonly event: EmpiricalOutcomeEvent;
  readonly probability: number;
  readonly count: number;
  readonly uncertainty: BinomialEstimate;
  /** Mean realized R conditional on this label. Null when the payoff is not identifiable. */
  readonly meanRealizedR: number | null;
  readonly payoffSampleSize: number;
}

export interface EmpiricalExpectancy {
  readonly expectedValueR: number;
  readonly grossR: number;
  readonly feesR: number;
  readonly slippageR: number;
  readonly fundingR: number;
  readonly methodologyVersion: "empirical-multistate-expectancy.v1";
}

export interface MultiOutcomeProbabilityEstimate {
  readonly probabilities: readonly OutcomeProbability[];
  readonly sampleSize: number;
  readonly condition: {
    readonly setupId: string;
    readonly side: "LONG" | "SHORT";
  };
  readonly trainingEnd: string;
  readonly estimatorVersion: "empirical-multinomial.v1";
  readonly expectancy: EmpiricalExpectancy;
}

/**
 * Estimates the complete observed outcome distribution. Unlike the binary
 * target-vs-invalidation estimator, TIME_EXIT and AMBIGUOUS remain in the
 * probability space instead of being discarded.
 *
 * The four event probabilities therefore sum exactly to 1 over usable labels.
 * Wilson intervals are reported per category as binomial marginal intervals;
 * they are not independent confidence intervals for the whole multinomial.
 */
export function estimateOutcomeDistribution(
  observations: readonly ResearchObservation[],
  condition: { readonly setupId: string; readonly side: "LONG" | "SHORT" },
  trainingEnd: string,
): MultiOutcomeProbabilityEstimate | null {
  const cutoff = Date.parse(trainingEnd);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid trainingEnd");

  const candidates = observations.filter((observation) =>
    observation.eligible &&
    observation.outcome !== null &&
    observation.setupId === condition.setupId &&
    observation.side === condition.side &&
    Number.isFinite(Date.parse(observation.eventTime)) &&
    Number.isFinite(Date.parse(observation.availableTime)) &&
    Date.parse(observation.eventTime) < cutoff &&
    Date.parse(observation.availableTime) <= cutoff,
  );

  if (!candidates.length) return null;

  const labels: readonly OutcomeLabel[] = ["TARGET", "INVALIDATION", "TIME_EXIT", "AMBIGUOUS"];
  const probabilities = labels.map((event) => {
    const matching = candidates.filter((observation) => observation.outcome!.label === event);
    const count = matching.length;
    const payoffObservations = event === "AMBIGUOUS"
      ? []
      : matching
        .map((observation) => observation.outcome!.realizedR)
        .filter((value) => Number.isFinite(value));
    const meanRealizedR = payoffObservations.length
      ? payoffObservations.reduce((sum, value) => sum + value, 0) / payoffObservations.length
      : event === "AMBIGUOUS" ? 0 : null;
    return {
      event,
      probability: count / candidates.length,
      count,
      uncertainty: estimateBinomial(count, candidates.length),
      meanRealizedR,
      payoffSampleSize: payoffObservations.length,
    };
  });

  const grossR = probabilities.reduce((sum, item) => {
    if (item.meanRealizedR === null) throw new Error(`Missing payoff estimate for ${item.event}`);
    return sum + item.probability * item.meanRealizedR;
  }, 0);

  return {
    probabilities,
    sampleSize: candidates.length,
    condition,
    trainingEnd: new Date(cutoff).toISOString(),
    estimatorVersion: "empirical-multinomial.v1",
    expectancy: {
      expectedValueR: grossR,
      grossR,
      feesR: 0,
      slippageR: 0,
      fundingR: 0,
      methodologyVersion: "empirical-multistate-expectancy.v1",
    },
  };
}
