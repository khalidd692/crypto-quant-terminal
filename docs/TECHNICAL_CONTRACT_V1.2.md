# Technical Contract V1.2

## 1. Scope

This contract defines a read-only/simulation quantitative decision terminal. It does not authorize live order placement.

## 2. Decision vocabulary

A decision must be exactly one of:

- LONG
- SHORT
- WAIT
- NO_TRADE
- INSUFFICIENT_EVIDENCE

NO_TRADE is a hard veto outcome, not a low score. INSUFFICIENT_EVIDENCE means the evidence is materially insufficient to estimate a defensible edge.

## 3. Pipeline

DATA → REGIME → FEATURES → SETUP → PROBABILITY → EXPECTANCY → RISK → LIQUIDITY → VETO → DECISION

Every stage must be traceable from a point-in-time input snapshot.

## 4. Domain separation

Asset, Instrument and Venue are separate entities.

An Asset identifies the underlying economic asset. An Instrument identifies the traded contract/market representation. A Venue identifies the exchange or market venue.

No feature, signal or outcome may silently collapse these identities.

## 5. Point-in-time integrity

Every observation has an event timestamp and an availability timestamp where relevant. Features used by a decision must be computable using information available at the decision timestamp.

No look-ahead. No future candle values. No post-event normalization leakage.

## 6. Features

Feature definitions are independent of signals. A feature must be computable for eligible observations even when no signal is emitted.

Each feature has:

- stable identifier
- definition
- parameters
- version
- required inputs
- availability assumptions
- missing-data behavior

## 7. Statistical observation unit

Every probability/edge estimate declares its observation unit explicitly, e.g. asset-instrument-venue × timestamp × setup instance.

Overlapping observations and dependent samples must be handled explicitly.

## 8. Outcomes

MFE and MAE conventions are fixed and documented for LONG and SHORT.

Outcome horizons, entry reference, fees, funding, slippage assumptions and intrabar rules are versioned.

OHLC data cannot prove an intrabar event order when both stop and target are touched within one candle. The system must mark such cases ambiguous or apply a predeclared conservative rule.

## 9. Probability and uncertainty

Probability is an empirical estimate derived from validated observations/models. Uncertainty is reported separately.

No arbitrary confidence score may be presented as a probability.

Multi-outcome probabilities must have a declared sample space and normalization rule; no forced summation is allowed across incompatible event definitions.

## 10. Setup and regime

Regime classification is independent from the final decision and is itself versioned and testable.

A setup describes market conditions before the decision. Signal generation must not redefine the features used to validate the setup.

## 11. Invalidation, stop and R

Invalidation is the price/condition at which the thesis is considered false.

A stop is an execution/risk mechanism and may differ from the analytical invalidation.

R is defined from the chosen risk reference. The system must never silently substitute stop distance for invalidation distance.

## 12. Risk and leverage

Risk sizing and leverage are separate controls.

Sizing considers at minimum:

- invalidation distance
- volatility
- liquidity
- portfolio exposure
- correlation
- BTC beta where relevant
- aggregate portfolio risk

Leverage must never be used to disguise excessive underlying risk.

## 13. Liquidity gate

Liquidity is a hard execution gate.

The terminal must consider spread, depth and expected slippage where data permits. A statistically attractive setup can still result in NO_TRADE when executable liquidity is inadequate.

## 14. Derivatives context

Where available, decisions may incorporate funding, open interest, liquidations and basis. Their timestamps and venue scope must remain explicit.

## 15. Expectancy

A trade candidate must pass an expectancy/payoff gate after realistic costs.

Expected value must account for:

- outcome probabilities
- payoff distribution
- fees
- slippage
- funding when applicable

Positive directional probability alone is insufficient.

## 16. Validation

Required methodology:

- time-ordered train/validation/test
- walk-forward evaluation
- purge/embargo where overlap creates leakage
- out-of-sample evaluation
- final untouched holdout
- realistic transaction costs
- baseline comparison
- ablation analysis
- multiple-testing/experiment tracking

No arbitrary minimum trade count is treated as a universal statistical guarantee.

## 17. Reproducibility

Signals reference exact versions of:

- dataset
- feature definitions
- regime logic
- setup logic
- model
- decision policy
- cost assumptions

A mutable database hash alone is not considered sufficient reproducibility.

## 18. Explainability

Every emitted decision must expose:

- evidence used
- regime
- setup
- probability estimate
- uncertainty
- expected value
- invalidation
- risk constraints
- liquidity status
- vetoes
- exact component versions

## 19. V1 constraint

V1 deliberately limits feature families to a small robust set (target: approximately 8–12 families). Complexity must be justified by measurable out-of-sample improvement.
