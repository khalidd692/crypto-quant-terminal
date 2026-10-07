# Crypto Quant Decision Terminal

V1.2 — architecture-first, validation-first quantitative decision support system.

## Status

Core quantitative foundation implemented. V1 remains read-only/simulation-oriented.

## Architecture

DATA → REGIME → FEATURES → SETUP → PROBABILITY → EXPECTANCY → RISK → LIQUIDITY → VETO → DECISION

## Implemented

- Explicit Asset / Instrument / Venue domain model
- Point-in-time market-data representation and validation
- Versioned feature definitions
- Core feature families: trend, momentum, volatility, volume and candle structure
- Empirical probability estimation with Wilson uncertainty intervals
- Expectancy calculation over an explicit probability space
- Invalidation-based position sizing with leverage and liquidity caps
- Liquidity hard gate
- Decision engine with WAIT / NO_TRADE / INSUFFICIENT_EVIDENCE
- Outcome simulation with explicit intrabar ambiguity
- Portfolio risk gate
- Backtest protocol with chronological splits and explicit purge/embargo policy
- Experiment registry
- GitHub Actions CI

## Deliberately not implemented

- Live order execution
- Exchange credentials
- Automatic capital deployment
- Black-box AI-generated probabilities
- Unvalidated predictive model claims

Those belong only after empirical validation and an explicit promotion decision.

## Next research layer

Connect a real, point-in-time data source through a provider adapter, build setup definitions, then run walk-forward research against immutable dataset versions.
