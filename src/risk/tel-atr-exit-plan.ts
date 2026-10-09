export const TEL_ATR_EXIT_DEFAULTS = Object.freeze({
  version: "tel-atr-exit.v1",
  catastropheStopAtr: 2.5,
  target1Atr: 2.0,
  target2Atr: 3.0,
  target1ReductionFraction: 0.5,
  timeReductionDays: 5,
  timeReductionFraction: 0.25,
  trailingAtr: 1.5
} as const);

export interface TelAtrExitInput {
  readonly entryPrice: number;
  readonly entryAtr: number;
  readonly currentPrice: number;
  readonly currentAtr: number;
  readonly highestSinceEntry: number;
  readonly entryAt: string;
  readonly asOf: string;
  readonly target1Reached: boolean;
  readonly previousStop: number | null;
  readonly remainingFraction: number;
}
export interface TelAtrExitPlan {
  readonly version: typeof TEL_ATR_EXIT_DEFAULTS.version;
  readonly catastropheStop: number;
  readonly target1: number;
  readonly target2: number;
  readonly reduceFractionNow: number;
  readonly trailingStop: number | null;
  readonly stopChange: { readonly previous: number; readonly next: number; readonly reason: string } | null;
  readonly reason: string;
  readonly remainingFraction: number;
}
export function calculateTelAtrExitPlan(input: TelAtrExitInput): TelAtrExitPlan {
  const positive = [input.entryPrice, input.entryAtr, input.currentPrice, input.currentAtr,
    input.highestSinceEntry, input.remainingFraction].every(Number.isFinite);
  if (!positive || input.entryPrice <= 0 || input.entryAtr <= 0 || input.currentPrice <= 0 ||
      input.currentAtr <= 0 || input.highestSinceEntry <= 0 ||
      input.remainingFraction < 0 || input.remainingFraction > 1) {
    throw new Error("Invalid TEL ATR exit input");
  }
  const entryMs = Date.parse(input.entryAt), nowMs = Date.parse(input.asOf);
  if (!Number.isFinite(entryMs) || !Number.isFinite(nowMs) || nowMs < entryMs) {
    throw new Error("Invalid TEL exit timestamps");
  }
  const d = TEL_ATR_EXIT_DEFAULTS;
  const catastropheStop = input.entryPrice - d.catastropheStopAtr * input.entryAtr;
  if (catastropheStop <= 0) throw new Error("Catastrophe stop must be positive");
  const target1 = input.entryPrice + d.target1Atr * input.entryAtr;
  const target2 = input.entryPrice + d.target2Atr * input.entryAtr;
  const ageDays = (nowMs - entryMs) / 86_400_000;
  let reduceFractionNow = 0;
  let reason = "Aucune réduction déclenchée";
  if (input.currentPrice <= catastropheStop) {
    reduceFractionNow = input.remainingFraction;
    reason = "Stop catastrophe fixe atteint";
  } else if (input.currentPrice >= target2) {
    reduceFractionNow = input.remainingFraction;
    reason = "Palier 2 atteint : sortir le reliquat";
  } else if (input.currentPrice >= target1 && !input.target1Reached) {
    reduceFractionNow = Math.min(input.remainingFraction, d.target1ReductionFraction);
    reason = "Palier 1 atteint : réduire de 50 % de la position initiale";
  } else if (!input.target1Reached && ageDays >= d.timeReductionDays) {
    reduceFractionNow = Math.min(input.remainingFraction, d.timeReductionFraction);
    reason = "Palier 1 non atteint après 5 jours : réduction temporelle";
  }
  let trailingStop: number | null = null;
  let stopChange: TelAtrExitPlan["stopChange"] = null;
  if (input.target1Reached && input.remainingFraction > 0) {
    const candidate = input.highestSinceEntry - d.trailingAtr * input.currentAtr;
    const previous = input.previousStop ?? catastropheStop;
    const next = Math.max(previous, candidate);
    trailingStop = next;
    if (next > previous) {
      stopChange = { previous, next, reason: "Stop suiveur ATR relevé; sens favorable uniquement" };
    }
  }
  return {
    version: d.version, catastropheStop, target1, target2, reduceFractionNow,
    trailingStop, stopChange, reason,
    remainingFraction: Math.max(0, input.remainingFraction - reduceFractionNow)
  };
}
