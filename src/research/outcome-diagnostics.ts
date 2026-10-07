import type { ResearchObservation, OutcomeLabel } from "./observation-ledger.js";

export interface OutcomeStateDiagnostic {
  readonly count: number;
  readonly meanGrossR: number | null;
  readonly meanNetR: number | null;
}

export interface OutcomeDiagnostics {
  readonly totalObservations: number;
  readonly cleanEligibleObservations: number;
  readonly excludedAmbiguous: number;
  readonly excludedOther: number;
  readonly exclusionReasons: Readonly<Record<string, number>>;
  readonly states: Readonly<Record<"TARGET" | "INVALIDATION" | "TIME_EXIT", OutcomeStateDiagnostic>>;
}

const STATES = ["TARGET", "INVALIDATION", "TIME_EXIT"] as const;

function riskFraction(observation: ResearchObservation): number | null {
  const atrRatio = observation.featureSnapshot.find((feature) => feature.featureId === "volatility.atr_ratio")?.value;
  if (atrRatio === null || atrRatio === undefined || !Number.isFinite(atrRatio)) return null;
  const risk = atrRatio * (observation.invalidationR ?? 0);
  return risk > 0 ? risk : null;
}

function grossR(observation: ResearchObservation): number | null {
  const outcome = observation.outcome;
  const risk = riskFraction(observation);
  if (!outcome || risk === null) return null;
  return (outcome.returnFraction + outcome.feesReturn + outcome.slippageReturn) / risk;
}

function netR(observation: ResearchObservation): number | null {
  return observation.outcome?.realizedR ?? null;
}

export function buildOutcomeDiagnostics(
  observations: readonly ResearchObservation[],
): OutcomeDiagnostics {
  const exclusionReasons: Record<string, number> = {};
  for (const observation of observations) {
    if (!observation.eligible || observation.outcome === null || observation.outcome.intrabarAmbiguous) {
      const reason = observation.outcome?.intrabarAmbiguous
        ? "AMBIGUOUS_INTRABAR"
        : observation.exclusionReason ?? "UNSPECIFIED";
      exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
    }
  }

  const states = Object.fromEntries(STATES.map((state) => {
    const values = observations.filter((observation) =>
      observation.eligible && observation.outcome?.label === state && !observation.outcome.intrabarAmbiguous
    );
    const gross = values.map(grossR).filter((value): value is number => value !== null);
    const net = values.map(netR).filter((value): value is number => value !== null);
    return [state, {
      count: values.length,
      meanGrossR: gross.length ? gross.reduce((sum, value) => sum + value, 0) / gross.length : null,
      meanNetR: net.length ? net.reduce((sum, value) => sum + value, 0) / net.length : null,
    }];
  })) as OutcomeDiagnostics["states"];

  const excludedAmbiguous = exclusionReasons.AMBIGUOUS_INTRABAR ?? 0;
  const excludedOther = Object.entries(exclusionReasons)
    .filter(([reason]) => reason !== "AMBIGUOUS_INTRABAR")
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    totalObservations: observations.length,
    cleanEligibleObservations: STATES.reduce((sum, state) => sum + states[state].count, 0),
    excludedAmbiguous,
    excludedOther,
    exclusionReasons,
    states,
  };
}
