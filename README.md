# Crypto Quant Decision Terminal

V1.2 — architecture-first, validation-first quantitative decision support system.

## Objective

Produce reproducible, falsifiable and explainable decisions:

- LONG
- SHORT
- WAIT
- NO_TRADE
- INSUFFICIENT_EVIDENCE

V1 is read-only/simulation-oriented. No live order execution.

## Decision pipeline

DATA → REGIME → FEATURES → SETUP → PROBABILITY → EXPECTANCY → RISK → LIQUIDITY → VETO → DECISION

## Engineering principles

- Point-in-time data and provenance
- Explicit Asset / Instrument / Venue separation
- Versioned feature definitions and datasets
- Independent feature computation
- Explicit statistical observation unit
- MFE/MAE with fixed sign conventions
- Probability separated from uncertainty
- Explicit OHLC intrabar ambiguity
- Invalidation separated from stop placement
- Risk separated from leverage
- Liquidity as a hard execution gate
- Derivatives context: funding, OI, liquidations, basis
- Payoff/expectancy gate
- Portfolio correlation, beta and aggregate risk constraints
- Walk-forward / purge / embargo / OOS / final holdout
- Baselines, ablations and multiple-testing controls
- Reproducible experiments and immutable versions
- Mandatory explanations and decision logs

See `docs/` for the technical contract and validation protocol.
