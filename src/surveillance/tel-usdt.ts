export type TelDecision = "ENTRER" | "ATTENDRE" | "SORTIR" | "NE_PAS_ENTRER";
export type DataQuality = "OK" | "STALE" | "UNAVAILABLE";
export type PositionSide = "LONG" | "NONE";
export interface VenueSnapshot {
  readonly venue: "KUCOIN" | "MEXC"; readonly symbol: string; readonly eventTime: string; readonly availableTime: string;
  readonly lastPrice: number; readonly bid: number; readonly ask: number; readonly volume24hQuote: number;
  readonly trendOk: boolean; readonly volatilityOk: boolean; readonly quality: DataQuality;
}
export interface TelSurveillanceConfig {
  readonly maxAgeMs: number; readonly maxCrossVenueDeviationBps: number;
  readonly entryZone: { readonly lower: number; readonly upper: number };
  readonly invalidationPrice: number; readonly target1: number; readonly target2: number;
  readonly maxLossQuote: number; readonly existingPosition: PositionSide; readonly exitTriggered: boolean;
}
export interface TelSurveillanceOutput {
  readonly decision: TelDecision; readonly reasons: readonly string[];
  readonly conditions: Readonly<Record<string, boolean | number>>;
  readonly levels: { readonly entryLower: number; readonly entryUpper: number; readonly invalidation: number; readonly target1: number; readonly target2: number };
  readonly positionSizing: { readonly quantity: number; readonly notionalQuote: number } | null;
  readonly source: "KUCOIN"; readonly crossCheck: "MEXC"; readonly degraded: boolean;
  readonly banner: "Règles de surveillance, aucun edge statistique démontré (phase 3 : PAS D'EDGE). Ce n'est pas une prédiction.";
}
const BANNER = "Règles de surveillance, aucun edge statistique démontré (phase 3 : PAS D'EDGE). Ce n'est pas une prédiction." as const;
function ageMs(snapshot: VenueSnapshot, nowMs: number): number { const t = Date.parse(snapshot.availableTime); return Number.isFinite(t) ? Math.max(0, nowMs - t) : Number.POSITIVE_INFINITY; }
function validNumber(value: number): boolean { return Number.isFinite(value) && value > 0; }
function crossVenueDeviationBps(primary: VenueSnapshot, secondary: VenueSnapshot): number {
  return Math.abs(primary.lastPrice - secondary.lastPrice) / ((primary.lastPrice + secondary.lastPrice) / 2) * 10_000;
}
export function evaluateTelSurveillance(kucoin: VenueSnapshot | null, mexc: VenueSnapshot | null, config: TelSurveillanceConfig, nowMs: number): TelSurveillanceOutput {
  const levels = { entryLower: config.entryZone.lower, entryUpper: config.entryZone.upper, invalidation: config.invalidationPrice, target1: config.target1, target2: config.target2 };
  const reasons: string[] = [];
  const hardDataFailure = kucoin === null || kucoin.quality === "UNAVAILABLE";
  const stalePrimary = kucoin !== null && (kucoin.quality === "STALE" || ageMs(kucoin, nowMs) > config.maxAgeMs);
  const secondaryUnavailable = mexc === null || mexc.quality === "UNAVAILABLE";
  const secondaryStale = mexc !== null && (mexc.quality === "STALE" || ageMs(mexc, nowMs) > config.maxAgeMs);
  const crossDeviation = kucoin && mexc ? crossVenueDeviationBps(kucoin, mexc) : null;
  const crossVenueBad = crossDeviation !== null && crossDeviation > config.maxCrossVenueDeviationBps;
  const degraded = hardDataFailure || stalePrimary || secondaryUnavailable || secondaryStale || crossVenueBad;
  if (hardDataFailure) reasons.push("Source primaire KuCoin indisponible");
  if (stalePrimary) reasons.push("Données KuCoin périmées");
  if (secondaryUnavailable) reasons.push("Contrôle croisé MEXC indisponible");
  if (secondaryStale) reasons.push("Données MEXC périmées");
  if (crossVenueBad) reasons.push("Écart KuCoin/MEXC supérieur au seuil configuré");
  if (degraded) {
    reasons.push("Mode dégradé: ENTRER interdit");
    return { decision: "NE_PAS_ENTRER", reasons, conditions: { dataFresh: false, crossVenueOk: !crossVenueBad, degraded: true }, levels, positionSizing: null, source: "KUCOIN", crossCheck: "MEXC", degraded: true, banner: BANNER };
  }
  if (!kucoin) throw new Error("KuCoin snapshot unexpectedly absent");
  const dataFresh = ageMs(kucoin, nowMs) <= config.maxAgeMs;
  const validLevels = validNumber(config.entryZone.lower) && validNumber(config.entryZone.upper) && config.entryZone.lower <= config.entryZone.upper
    && validNumber(config.invalidationPrice) && validNumber(config.target1) && validNumber(config.target2);
  const entryPrice = kucoin.lastPrice;
  const inEntryZone = entryPrice >= config.entryZone.lower && entryPrice <= config.entryZone.upper;
  const riskPerUnit = Math.abs(entryPrice - config.invalidationPrice);
  const rewardPerUnit = Math.max(config.target1, config.target2) - entryPrice;
  const rr = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
  const sizingValid = validNumber(config.maxLossQuote) && riskPerUnit > 0;
  const quantity = sizingValid ? config.maxLossQuote / riskPerUnit : 0;
  const notionalQuote = quantity * entryPrice;
  const conditions = { dataFresh, crossVenueOk: true, inEntryZone, trendOk: kucoin.trendOk, volatilityOk: kucoin.volatilityOk, rr, sizingValid, degraded: false };
  if (config.existingPosition === "LONG" && config.exitTriggered) {
    reasons.push("Position LONG: condition de sortie configurée atteinte");
    return { decision: "SORTIR", reasons, conditions, levels, positionSizing: sizingValid ? { quantity, notionalQuote } : null, source: "KUCOIN", crossCheck: "MEXC", degraded: false, banner: BANNER };
  }
  if (!validLevels || !sizingValid) {
    reasons.push("Configuration de niveaux ou risque obligatoire invalide/incomplète");
    return { decision: "NE_PAS_ENTRER", reasons, conditions, levels, positionSizing: null, source: "KUCOIN", crossCheck: "MEXC", degraded: false, banner: BANNER };
  }
  if (dataFresh && inEntryZone && kucoin.trendOk && kucoin.volatilityOk && rr >= 2 && sizingValid) {
    reasons.push("Toutes les conditions configurées sont satisfaites");
    return { decision: "ENTRER", reasons, conditions, levels, positionSizing: { quantity, notionalQuote }, source: "KUCOIN", crossCheck: "MEXC", degraded: false, banner: BANNER };
  }
  reasons.push("Conditions d'entrée incomplètes: surveillance en attente");
  return { decision: "ATTENDRE", reasons, conditions, levels, positionSizing: { quantity, notionalQuote }, source: "KUCOIN", crossCheck: "MEXC", degraded: false, banner: BANNER };
}