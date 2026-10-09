export const TEL_EXIT_POLICY = Object.freeze({
  catastropheStopAtr: 2,
  target1Atr: 1.5,
  target2Atr: 2.5,
  trailingAtr: 2,
  target1Fraction: 1 / 3,
  target2Fraction: 1 / 3,
  timeReductionFraction: 1 / 3,
  timeReductionAfterDays: 7,
  version: "tel-spot-exit.v1"
} as const);

export interface TelExitPlan {
  readonly entryPrice: number;
  readonly atrAtEntry: number;
  readonly initialQuantity: number;
  readonly enteredAt: string;
  readonly catastropheStop: number;
  readonly target1: number;
  readonly target2: number;
  readonly policyVersion: typeof TEL_EXIT_POLICY.version;
}

export interface TelExitState {
  readonly remainingQuantity: number;
  readonly target1Reached: boolean;
  readonly target2Reached: boolean;
  readonly timeReductionApplied: boolean;
  readonly bestPriceSinceTarget2: number | null;
  readonly currentTrailingStop: number | null;
}

export type TelExitAction =
  | { readonly type: "REDUCE"; readonly reason: "TARGET_1" | "TARGET_2" | "TIME_REDUCTION"; readonly quantity: number }
  | { readonly type: "CATASTROPHE_STOP"; readonly stopPrice: number }
  | { readonly type: "UPDATE_TRAILING_STOP"; readonly stopPrice: number; readonly previousStop: number | null };

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function createTelExitPlan(entryPrice: number, atrAtEntry: number, initialQuantity: number, enteredAt: string): TelExitPlan {
  if (!positive(entryPrice) || !positive(atrAtEntry) || !positive(initialQuantity)) {
    throw new Error("Entry, ATR and quantity must be finite positive values");
  }
  if (!Number.isFinite(Date.parse(enteredAt))) throw new Error("Invalid entry timestamp");
  const catastropheStop = entryPrice - TEL_EXIT_POLICY.catastropheStopAtr * atrAtEntry;
  if (catastropheStop <= 0) throw new Error("Catastrophe stop must remain above zero");
  return {
    entryPrice,
    atrAtEntry,
    initialQuantity,
    enteredAt,
    catastropheStop,
    target1: entryPrice + TEL_EXIT_POLICY.target1Atr * atrAtEntry,
    target2: entryPrice + TEL_EXIT_POLICY.target2Atr * atrAtEntry,
    policyVersion: TEL_EXIT_POLICY.version
  };
}

export function evaluateTelExitActions(
  plan: TelExitPlan,
  state: TelExitState,
  currentPrice: number,
  now: string,
  currentAtr: number
): readonly TelExitAction[] {
  if (!positive(currentPrice) || !positive(state.remainingQuantity) || !positive(currentAtr)) {
    throw new Error("Current price, remaining quantity and ATR must be finite positive values");
  }
  const nowMs = Date.parse(now);
  const entryMs = Date.parse(plan.enteredAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(entryMs) || nowMs < entryMs) {
    throw new Error("Invalid or pre-entry evaluation timestamp");
  }
  const actions: TelExitAction[] = [];
  if (currentPrice <= plan.catastropheStop) {
    actions.push({ type: "CATASTROPHE_STOP", stopPrice: plan.catastropheStop });
    return actions;
  }
  const target1Qty = Math.min(state.remainingQuantity, plan.initialQuantity * TEL_EXIT_POLICY.target1Fraction);
  if (!state.target1Reached && currentPrice >= plan.target1 && target1Qty > 0) {
    actions.push({ type: "REDUCE", reason: "TARGET_1", quantity: target1Qty });
  }
  const target2Qty = Math.min(state.remainingQuantity, plan.initialQuantity * TEL_EXIT_POLICY.target2Fraction);
  if (!state.target2Reached && currentPrice >= plan.target2 && target2Qty > 0) {
    actions.push({ type: "REDUCE", reason: "TARGET_2", quantity: target2Qty });
  }
  const ageDays = (nowMs - entryMs) / 86_400_000;
  if (!state.target1Reached && !state.timeReductionApplied && ageDays >= TEL_EXIT_POLICY.timeReductionAfterDays) {
    actions.push({
      type: "REDUCE",
      reason: "TIME_REDUCTION",
      quantity: Math.min(state.remainingQuantity, state.remainingQuantity * TEL_EXIT_POLICY.timeReductionFraction)
    });
  }
  if (state.target2Reached && state.bestPriceSinceTarget2 !== null && positive(state.bestPriceSinceTarget2)) {
    const proposed = state.bestPriceSinceTarget2 - TEL_EXIT_POLICY.trailingAtr * currentAtr;
    const previous = state.currentTrailingStop;
    if (proposed > 0 && (previous === null || proposed > previous)) {
      actions.push({ type: "UPDATE_TRAILING_STOP", stopPrice: proposed, previousStop: previous });
    }
  }
  return actions;
}

/** Validates an append-only stop update for a long Spot position. */
export function validateFavorableStopUpdate(previousStop: number | null, proposedStop: number): void {
  if (!positive(proposedStop)) throw new Error("Proposed stop must be finite and positive");
  if (previousStop !== null && (!positive(previousStop) || proposedStop < previousStop)) {
    throw new Error("Stop update rejected: a long Spot stop may only move in the favorable direction");
  }
}
