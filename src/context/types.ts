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
export interface ContextSnapshot {
  readonly schemaVersion:"context-snapshot.v1"; readonly runId:string; readonly snapshotId:string; readonly instrumentId:string; readonly asOf:string;
  readonly market:CryptoMarketContext; readonly macro:MacroContext; readonly events:EventCalendarContext; readonly liquidity:LiquidityContext;
  readonly fundamentals:FundamentalContext; readonly macroRegime:MacroRegimeContext; readonly provenance:readonly ContextProvenance[];
  readonly snapshotHash:`sha256:${string}`;
}