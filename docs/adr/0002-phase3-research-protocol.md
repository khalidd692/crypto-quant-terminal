# ADR-0002 — Phase 3 research protocol freeze

- **Status:** Accepted
- **Date:** 2026-10-07
- **Scope:** Phase 3 — BTCUSDT, Binance USDⓈ-M futures, 1h
- **Contract:** V1.2
- **Amendment status:** Amended before any research run; no result was observed before this amendment.
- **Required commit message:** `amendé avant tout run, aucun résultat observé`

## Decision

Phase 3 uses one immutable research protocol. All parameters below are frozen before research execution and are part of experiment identity.

No parameter may be changed after observing a research result. Any change requires a new experiment-registry entry and a new ADR before another run. A disappointing result remains a valid result.

## 1. Dataset

| Item | Frozen value |
|---|---|
| Instrument | BTCUSDT |
| Market | Binance USDⓈ-M Futures |
| Candle interval | 1h |
| Dataset interval | `[2020-01-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z[` UTC |
| Research interval | `[2020-01-01T00:00:00.000Z, 2026-01-01T00:00:00.000Z[` UTC |
| Holdout interval | `[2026-01-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z[` UTC |
| Dataset consumed by `npm run research` | Research interval only |
| Holdout consumed by `npm run research` | **NONE** |

All timestamp intervals are UTC and semi-open `[start,end[`. Research data is accepted only through the fail-closed research loader, which rejects every event timestamp `>= 2026-01-01T00:00:00.000Z`.

Historical klines must be validated for ordering, duplicates, invalid OHLC/volume rows and gaps. The research dataset artifact is content-hashed and versioned.

The holdout is a separate artifact with its own content hash and is not loaded by `npm run research`.

## 2. Train / validation / test / holdout

| Partition | UTC semi-open interval | Purpose |
|---|---|---|
| Train | `[2020-01-01T00:00:00.000Z, 2023-01-01T00:00:00.000Z[` | Estimation / model fitting |
| Validation | `[2023-01-01T00:00:00.000Z, 2024-01-01T00:00:00.000Z[` | Frozen protocol evaluation; no parameter tuning |
| Test | `[2024-01-01T00:00:00.000Z, 2026-01-01T00:00:00.000Z[` | One-time development OOS evaluation |
| Final holdout | `[2026-01-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z[` | One-time final evaluation |

The validation window does not select or tune parameters. The test window is evaluated once, only after implementation tests and validation-stage checks are green.

Walk-forward evaluation is chronological. Purge and embargo are fixed at **8 hours each**. The purge equals the maximum frozen outcome horizon (8 × 1h) and prevents an outcome window from crossing a downstream boundary. The 8-hour embargo is also at least the 8-hour outcome horizon and is greater than the core-feature warm-up requirement used by V1. The rationale is protocol-derived, not a day-based magic value.

## 3. Outcome definition

| Parameter | Frozen value |
|---|---|
| Horizon | 8 × 1h candles = 8h |
| Target | 1.5R |
| Invalidation | 1.0R |
| Entry reference | Decision candle close |
| Intrabar target/invalidation ambiguity | `AMBIGUOUS`; never silently resolved |
| Unresolved horizon | `TIME_EXIT` |
| Features | Point-in-time through decision time only |

Invalidation is an outcome boundary, not a broker stop.

## 4. Trading costs

| Cost | Frozen value |
|---|---:|
| Taker fee | 0.0004 = 4 bps **per side** |
| Slippage | 0.0002 = 2 bps **per side** |
| Funding | Historical Binance USDⓈ-M funding rates |

Funding is aligned to the holding interval and side. Missing required funding observations are not silently imputed.

## 5. Cost sensitivity

The same frozen observations and decision logic are evaluated at:
- ×1.0 fee and slippage;
- ×1.5 fee and slippage;
- ×2.0 fee and slippage.

No other parameter changes.

## 6. Baselines

Every validation/test report includes:
1. **NO_TRADE:** zero trades, zero strategy return and zero strategy drawdown.
2. **BUY_AND_HOLD:** BTCUSDT buy-and-hold over the exact same semi-open evaluation interval; reported in return fraction, not compared directly to R-denominated strategy performance.
3. **RANDOM_ENTRY:** 1,000 independent deterministic draws. Same eligible timestamps, ATR-derived 1.5R target, 1.0R invalidation, 8h horizon, fees, slippage and funding; only entry side is randomized. Master seed `20261007`; draw seed = master seed + draw index.
4. **ALWAYS_LONG:** LONG on the same eligible timestamps with the same exits, costs and funding.

Random-entry reports its distribution of mean realizedR and its 95th percentile.

## 7. Success criteria — frozen before any run

The verdict is **PAS D'EDGE** unless **all three criteria pass separately on both validation and test**. There is no post-hoc reformulation.

### Criterion 1
The dependence-adjusted Wilson lower bound for target-before-invalidation probability, using the non-overlapping sample from Phase 2, must be strictly greater than the **cost-derived break-even probability** for the same partition and same realized cost assumptions.

The break-even probability is calculated from the frozen target/invalidation payoffs after the actual per-trade fee and slippage costs; it is not a fixed magic threshold.

### Criterion 2
Under fee and slippage ×1.5, the 95% lower bound of the moving-block bootstrap mean of `realizedR` must be strictly greater than zero.

Frozen bootstrap: block size 8 observations / 8h; 2,000 resamples; confidence 95%.

### Criterion 3
The setup's mean `realizedR` must be strictly greater than the **95th percentile** of the 1,000-draw random-entry distribution of mean `realizedR`.

Failure of any one criterion in either validation or test yields exactly **PAS D'EDGE**. No alternative metric, threshold, partition or baseline may be substituted after observing results.

## 8. Reporting

Every validation/test report MUST include:
- naive Wilson estimate;
- dependence-adjusted Wilson estimate;
- effective sample size;
- moving-block bootstrap of `realizedR`;
- all four baselines;
- calendar-year results;
- cost sensitivity ×1 / ×1.5 / ×2;
- the three criterion pass/fail states separately for validation and test.

## 9. Holdout lock

The final holdout dataset is separate and content-hashed.

`npm run research` MUST NOT read, download, parse, score, fit on, calibrate on, tune on, or otherwise consume any observation from the holdout interval.

A dedicated holdout script is the only permitted holdout reader. It is written and tested on synthetic data during Phase 3 but MUST NOT be executed without an explicit separate order.

The holdout script:
- uses a frozen model/version;
- performs no fitting, feature selection, threshold tuning or calibration;
- records the holdout artifact hash and protocol/ADR version;
- records the execution in the experiment registry;
- fails closed if model training ends after holdout start.

## 10. Experiment registry

Every execution creates an immutable registry entry, including failed or disappointing executions.

Each entry records at minimum:
- experiment ID and UTC execution timestamp;
- ADR/protocol version;
- code version;
- dataset and holdout artifact hashes;
- exact UTC semi-open boundaries;
- train/validation/test/holdout status;
- feature-definition versions;
- setup ID;
- outcome horizon/target/invalidation;
- fee/slippage/funding;
- purge/embargo;
- bootstrap/dependence configuration;
- baseline configuration and random seed/draw count;
- exclusions and outcome counts;
- report/artifact hash;
- terminal state and failure reason.

A run is registered before its result is considered. Failed runs are retained.

## 11. Red Team / stop line

Phase 3 is blocked for unresolved:
- look-ahead/PIT leakage;
- timestamp ambiguity;
- holdout contamination;
- unverifiable dataset identity;
- missing registry entry;
- silent data imputation;
- post-result parameter change without a new ADR;
- cost/funding ambiguity;
- contradiction between executed and reported protocol.

No new indicator, feature, signal family, live execution or credential is introduced.

## 12. Explicit non-decisions

This ADR does not add indicators, features, live trading, credentials, execution or new signal families.
