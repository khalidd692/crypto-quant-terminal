export type ISO8601 = string & { readonly __brand: "ISO8601" };
export type UUID = string & { readonly __brand: "UUID" };
export type Hash = string & { readonly __brand: "Hash" };

export type Decision = "LONG" | "SHORT" | "WAIT" | "NO_TRADE" | "INSUFFICIENT_EVIDENCE";

export type Side = "LONG" | "SHORT";
export type VenueType = "spot" | "perpetual" | "future" | "option";
export type DataQuality = "complete" | "partial" | "invalid";

export interface Asset {
  readonly assetId: string;
  readonly symbol: string;
  readonly name: string;
}

export interface Venue {
  readonly venueId: string;
  readonly name: string;
  readonly type: "centralized" | "decentralized" | "other";
}

export interface Instrument {
  readonly instrumentId: string;
  readonly venueId: Venue["venueId"];
  readonly baseAssetId: Asset["assetId"];
  readonly quoteAsset: string;
  readonly symbol: string;
  readonly venueType: VenueType;
  readonly contractMultiplier?: number;
}

export interface MarketDataPoint {
  readonly instrumentId: Instrument["instrumentId"];
  readonly eventTime: ISO8601;
  readonly availableTime: ISO8601;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly dataQuality: DataQuality;
  readonly sourceId: string;
}

export interface FeatureDefinition {
  readonly featureId: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly requiredInputs: readonly string[];
  readonly availabilityRule: string;
  readonly missingDataPolicy: "reject" | "partial" | "impute";
}

export interface FeatureSnapshot {
  readonly featureId: FeatureDefinition["featureId"];
  readonly featureVersion: FeatureDefinition["version"];
  readonly instrumentId: Instrument["instrumentId"];
  readonly eventTime: ISO8601;
  readonly availableTime: ISO8601;
  readonly value: number | null;
  readonly inputDataVersion: string;
}

export interface Regime {
  readonly regimeId: string;
  readonly version: string;
  readonly instrumentId: Instrument["instrumentId"];
  readonly eventTime: ISO8601;
  readonly label: string;
  readonly confidence: number | null;
  readonly featureSnapshotIds: readonly UUID[];
}

export interface ProbabilityEstimate {
  readonly event: string;
  readonly probability: number;
  readonly sampleSize: number;
  readonly estimatorVersion: string;
}

export interface UncertaintyEstimate {
  readonly method: string;
  readonly lower: number | null;
  readonly upper: number | null;
  readonly level: number | null;
}

export interface Expectancy {
  readonly expectedValue: number;
  readonly unit: "quote_currency" | "return" | "R";
  readonly gross: number;
  readonly fees: number;
  readonly slippage: number;
  readonly funding: number;
  readonly methodologyVersion: string;
}

export interface Invalidation {
  readonly type: "price" | "condition";
  readonly reference: string;
  readonly level?: number;
  readonly rationale: string;
}

export interface LiquidityAssessment {
  readonly passed: boolean;
  readonly spreadBps: number | null;
  readonly estimatedSlippageBps: number | null;
  readonly depthQuote: number | null;
  readonly stressScenario: string;
  readonly methodologyVersion: string;
}

export interface RiskSnapshot {
  readonly riskVersion: string;
  readonly maxLossQuote: number;
  readonly volatility: number | null;
  readonly invalidationDistance: number | null;
  readonly leverage: number;
  readonly portfolioRiskBefore: number;
  readonly portfolioRiskAfter: number;
  readonly correlationToPortfolio: number | null;
  readonly betaToReference: number | null;
}

export interface Signal {
  readonly signalId: UUID;
  readonly instrumentId: Instrument["instrumentId"];
  readonly decisionTime: ISO8601;
  readonly decision: Decision;
  readonly side: Side | null;
  readonly regimeId: Regime["regimeId"] | null;
  readonly setupId: string | null;
  readonly featureSnapshotIds: readonly UUID[];
  readonly probabilities: readonly ProbabilityEstimate[];
  readonly uncertainty: readonly UncertaintyEstimate[];
  readonly expectancy: Expectancy | null;
  readonly invalidation: Invalidation | null;
  readonly risk: RiskSnapshot | null;
  readonly liquidity: LiquidityAssessment | null;
  readonly vetoReasons: readonly string[];
  readonly datasetVersion: string;
  readonly modelVersion: string | null;
  readonly decisionPolicyVersion: string;
}

export interface Outcome {
  readonly signalId: Signal["signalId"];
  readonly evaluationTime: ISO8601;
  readonly horizon: string;
  readonly realizedReturn: number;
  readonly mfeR: number | null;
  readonly maeR: number | null;
  readonly targetHit: boolean | null;
  readonly stopHit: boolean | null;
  readonly invalidationHit: boolean | null;
  readonly intrabarAmbiguous: boolean;
  readonly fees: number;
  readonly slippage: number;
  readonly funding: number;
  readonly outcomeProtocolVersion: string;
}

export interface DatasetVersion {
  readonly datasetVersion: string;
  readonly createdAt: ISO8601;
  readonly sourceIds: readonly string[];
  readonly coverageStart: ISO8601;
  readonly coverageEnd: ISO8601;
  readonly methodologyVersion: string;
  readonly immutable: true;
}

export interface ModelVersion {
  readonly modelVersion: string;
  readonly createdAt: ISO8601;
  readonly datasetVersion: DatasetVersion["datasetVersion"];
  readonly featureDefinitionVersions: readonly string[];
  readonly trainingWindow: { readonly start: ISO8601; readonly end: ISO8601 };
  readonly immutable: true;
}

export interface PortfolioSnapshot {
  readonly portfolioSnapshotId: UUID;
  readonly timestamp: ISO8601;
  readonly grossExposureQuote: number;
  readonly netExposureQuote: number;
  readonly riskQuote: number;
  readonly positions: readonly {
    readonly instrumentId: Instrument["instrumentId"];
    readonly side: Side;
    readonly notionalQuote: number;
    readonly riskQuote: number;
  }[];
}
