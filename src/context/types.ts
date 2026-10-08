export interface ContextProvenance {
  readonly field:string; readonly source:string; readonly availableAt:string;
  readonly sourceSnapshotHash:`sha256:${string}`; readonly status:"OK"|"UNAVAILABLE"; readonly reason?:string;
}
export interface CryptoMarketContext {
  readonly totalMarketCapQuote:number|null; readonly btcDominancePct:number|null; readonly btcReturnPct:number|null;
  readonly realizedVolPct:number|null; readonly breadthPct:number|null; readonly fundingRatePct?:number|null;
  readonly openInterestQuote?:number|null; readonly sentimentScore?:number|null;
}
export interface MacroContext {
  readonly ratesBias:"EASING"|"NEUTRAL"|"TIGHTENING"|"UNKNOWN";
  readonly inflationBias:"DISINFLATION"|"NEUTRAL"|"INFLATIONARY"|"UNKNOWN";
  readonly dollarBias:"WEAKENING"|"NEUTRAL"|"STRENGTHENING"|"UNKNOWN";
  readonly policyRatePct?:number|null; readonly tenYearYieldPct?:number|null; readonly dollarIndex?:number|null;
  readonly cpiYoYPct?:number|null; readonly sourceAsOf:string|null;
}
export interface EventCalendarContext { readonly events:readonly { readonly id:string; readonly timestamp:string; readonly category:"MACRO"|"CRYPTO"|"REGULATORY"|"PROTOCOL"|"OTHER"; readonly label:string; readonly importance:"LOW"|"MEDIUM"|"HIGH"; }[]; }
export interface LiquidityContext {
  readonly venue:string; readonly symbol:string; readonly spreadBps:number|null; readonly depthQuote:number|null;
  readonly volume24hQuote:number|null; readonly stablecoinMarketCapQuote?:number|null; readonly stablecoinSourceAsOf?:string|null; readonly observedAt:string;
}
export interface FundamentalContext { readonly protocolActivity:"IMPROVING"|"STABLE"|"DETERIORATING"|"UNKNOWN"; readonly developmentActivity:"IMPROVING"|"STABLE"|"DETERIORATING"|"UNKNOWN"; readonly valuationAssessment:"LOW"|"FAIR"|"HIGH"|"UNKNOWN"; readonly sourceAsOf:string|null; }
export interface MacroRegimeContext { readonly regime:"RISK_ON"|"RISK_OFF"|"TRANSITION"|"NEUTRAL"|"UNKNOWN"; readonly rationale:string; readonly methodologyVersion:"descriptive-regime.v1"; }
export interface ExternalSeriesPoint { readonly observedAt:string; readonly value:number|null; readonly source:string; readonly sourceSnapshotHash:string; }
export interface RollingCorrelation { readonly windowDays:30|90|180; readonly coefficient:number|null; readonly interval:[number|null,number|null]; readonly signInversion:boolean; readonly rupture:boolean; readonly label:"corrélation descriptive, pas causale, instable"; }
export interface TelFundamentalContext { readonly circulatingSupply:number|null; readonly totalSupply:number|null; readonly marketCapQuote:number|null; readonly newsCount:number|null; readonly latestNews:readonly {readonly date:string;readonly title:string}[]; readonly tokenUnlocks:"OK"|"UNAVAILABLE"; readonly networkActivity:"OK"|"UNAVAILABLE"; readonly notableFlows:"OK"|"UNAVAILABLE"; readonly sourceAsOf:string|null; }
export interface SocialSentimentContext { readonly mentions:number|null; readonly mentionChangePct:number|null; readonly toneScore:number|null; readonly concentrationTop5Pct:number|null; readonly attentionSpike:boolean|null; readonly temperature:"LOW"|"NEUTRAL"|"HOT"|"UNAVAILABLE"; readonly label:"indice de température, bruité et manipulable, pas une prévision"; readonly sourceAsOf:string|null; }
export interface ContextSnapshot {
  readonly schemaVersion:"context-snapshot.v1"; readonly runId:string; readonly snapshotId:string; readonly instrumentId:string; readonly asOf:string;
  readonly market:CryptoMarketContext; readonly macro:MacroContext; readonly events:EventCalendarContext; readonly liquidity:LiquidityContext;
  readonly fundamentals:FundamentalContext; readonly macroRegime:MacroRegimeContext; readonly provenance:readonly ContextProvenance[];
  readonly macroSeries?: Readonly<Record<string,readonly ExternalSeriesPoint[]>>; readonly correlations?: Readonly<Record<string,readonly RollingCorrelation[]>>; readonly fundamentalsTel?: TelFundamentalContext; readonly socialSentiment?: SocialSentimentContext; readonly snapshotHash:`sha256:${string}`;
}