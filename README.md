# Crypto Quant Decision Terminal

V1.2 — architecture-first, validation-first quantitative decision support system.

## Status

The read-only quantitative foundation and a minimal mobile web terminal are implemented. This is not a live-trading bot.

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
- Probability calibration metrics (Brier score and log loss)
- Explicit cost-aware expectancy and break-even probability
- Invalidation-based position sizing with leverage and liquidity caps
- Liquidity hard gate
- Portfolio risk gate
- Separate hard-veto engine
- Multi-timeframe alignment contract
- Cost-aware outcome simulation with explicit intrabar ambiguity
- Chronological backtest protocol with explicit purge/embargo fields
- Experiment registry
- GitHub Actions build/test pipeline
- CLI and minimal mobile web API/UI

## Run

After installing Node.js 22:

`npm install`
`npm run build`
`npm run server`

Open the server on port 3000. The terminal is read-only and uses public market data.

For CLI evaluation:

`npm run terminal -- BTCUSDT 1h`

The terminal deliberately returns INSUFFICIENT_EVIDENCE until a validated empirical probability/expectancy model is supplied.

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

## Deliberately not implemented

- Live order execution
- Exchange credentials
- Automatic capital deployment
- Black-box AI-generated probabilities
- Unvalidated predictive model claims

These are intentionally blocked until the research gate is satisfied.

## Documentation

- `docs/TECHNICAL_CONTRACT_V1.2.md`
- `docs/DATA_MODEL.md`
- `docs/VALIDATION_PROTOCOL.md`
- `docs/RED_TEAM_RULES.md`
- `docs/DATA_PROVIDER.md`
- `docs/RESEARCH_PROTOCOL.md`
- `docs/DECISIONS.md`
