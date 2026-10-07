# Crypto Quant Decision Terminal

V1.2 — architecture-first, validation-first quantitative decision support system.

## Status

The read-only quantitative foundation is implemented. It is not a live-trading bot.

## Architecture

DATA → REGIME → FEATURES → SETUP → PROBABILITY → EXPECTANCY → RISK → LIQUIDITY → VETO → DECISION

## Implemented

- Explicit Asset / Instrument / Venue domain model
- Point-in-time market-data representation and validation
- Immutable SHA-256 dataset versioning
- Binance public Spot/USDⓈ-M Futures read-only adapter
- Open-candle exclusion and configurable availability lag
- Core feature families: trend, momentum, volatility, volume and candle structure
- Transparent baseline setup
- Empirical probability estimation with Wilson uncertainty intervals
- Explicit expectancy calculation
- Invalidation-based position sizing with leverage and liquidity caps
- Liquidity hard gate
- Portfolio risk gate
- Decision engine with WAIT / NO_TRADE / INSUFFICIENT_EVIDENCE
- Cost-aware outcome simulation
- Explicit intrabar ambiguity
- Chronological backtest protocol with purge/embargo fields
- Experiment registry
- GitHub Actions build/test pipeline
- Mobile-safe CLI path for read-only market evaluation

## Run

After installing Node.js 22 and dependencies:

`npm install`

`npm run build`

`npm run terminal -- BTCUSDT 1h`

The terminal deliberately returns INSUFFICIENT_EVIDENCE until a validated empirical probability/expectancy model is supplied.

## Deliberately not implemented

- Live order execution
- Exchange credentials
- Automatic capital deployment
- Black-box AI-generated probabilities
- Unvalidated predictive model claims

These are intentionally blocked until the research protocol is satisfied.

## Research gate

A model cannot be promoted from research to decision production without:

1. frozen dataset version;
2. point-in-time integrity;
3. predefined train/validation/test windows;
4. justified purge/embargo;
5. walk-forward evaluation;
6. untouched final holdout;
7. realistic fees/slippage/funding;
8. calibration and uncertainty analysis;
9. regime/liquidity breakdown;
10. baseline and ablation comparison;
11. experiment registry review;
12. reproducible artifacts.

## Source of truth

Architecture and implementation live in GitHub. The main branch is protected conceptually by review; implementation is developed on feature branches and merged only after validation.

## Documentation

- `docs/TECHNICAL_CONTRACT_V1.2.md`
- `docs/DATA_MODEL.md`
- `docs/VALIDATION_PROTOCOL.md`
- `docs/RED_TEAM_RULES.md`
- `docs/DATA_PROVIDER.md`
- `docs/RESEARCH_PROTOCOL.md`
- `docs/DECISIONS.md`
