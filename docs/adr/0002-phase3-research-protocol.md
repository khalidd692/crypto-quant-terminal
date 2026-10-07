# ADR-0002 — Phase 3 research protocol freeze

- **Status:** Accepted
- **Date:** 2026-10-07
- **Scope:** Phase 3 only — BTCUSDT, USDⓈ-M futures, 1h
- **Contract:** V1.2
- **Precondition:** This ADR MUST be merged before the first Phase 3 research run.

## Decision

Phase 3 uses one immutable research protocol. The protocol below is frozen before any Phase 3 run and is part of the experiment identity.

No parameter in this ADR may be changed after observing a research result. Any change requires:

1. a new experiment-registry entry;
2. a new ADR explaining the change and its rationale;
3. a new run from the resulting immutable protocol.

A disappointing result is a valid result and MUST be retained in the experiment registry.

## 1. Dataset

| Item | Frozen value |
|---|---|
| Instrument | BTCUSDT |
| Market | Binance USDⓈ-M Futures |
| Candle interval | 1h |
| Dataset start | 2020-01-01T00:00:00.000Z |
| Dataset end | 2026-10-01T00:00:00.000Z |
| Holdout start | 2026-01-01T00:00:00.000Z |
| Holdout end | 2026-10-01T00:00:00.000Z |
| Dataset used by `npm run research` | 2020-01-01 through 2026-01-01, end-exclusive |
| Holdout used by `npm run research` | **NONE** |

The historical kline dataset must be validated for timestamp ordering, duplicates, invalid OHLC/volume rows and gaps. The resulting dataset artifact is content-hashed and versioned.

The dataset boundary is event-time based and end-exclusive.

## 2. Train / validation / test / holdout

The frozen chronological partitions are:

| Partition | Start | End | Purpose |
|---|---|---|---|
| Train | 2020-01-01 | 2023-01-01 | Estimation / model fitting |
| Validation | 2023-01-01 | 2024-01-01 | OOS policy/calibration selection |
| Test | 2024-01-01 | 2026-01-01 | Final development OOS evaluation |
| Final holdout | 2026-01-01 | 2026-10-01 | One-time final evaluation |

All boundaries are UTC and end-exclusive.

The walk-forward executor remains chronological and uses purge/embargo rules derived from the outcome horizon. No future observation may influence a training or validation decision.

### Holdout lock

`npm run research` MUST NOT read, download, parse, score, fit on, calibrate on, tune on, or otherwise consume observations from the final-holdout interval.

The final holdout is evaluated by a separate script invoked exactly once for the frozen protocol. That invocation MUST:

- use the frozen model/version;
- perform no fitting, feature selection, threshold tuning or calibration;
- record the holdout execution as an experiment-registry event;
- record the protocol/ADR version and holdout dataset artifact hash;
- fail closed if the model training end is after the holdout start.

The final holdout result is not a development signal and MUST NOT be used to alter the Phase 3 protocol.

## 3. Outcome definition

| Parameter | Frozen value |
|---|---|
| Horizon | 8 × 1h candles |
| targetR | 1.5R |
| invalidationR | 1.0R |
| Entry reference | Decision candle close |
| Ambiguous intrabar target/invalidation | `AMBIGUOUS`; never silently resolved |
| Unresolved horizon | `TIME_EXIT` |
| PIT rule | Features use data available through decision time only |

The invalidation level is an outcome-definition boundary. It is not a broker stop order and MUST NOT be conflated with execution risk controls.

## 4. Trading costs

The frozen baseline simulation costs are:

| Cost | Frozen value |
|---|---:|
| Fee rate | 0.0004 per side (4 bps) |
| Slippage rate | 0.0002 per side (2 bps) |
| Funding | Historical Binance USDⓈ-M funding rates |

Funding MUST be aligned by event/holding interval and side. If historical funding data required for an observation is unavailable, the observation MUST NOT be silently imputed.

The baseline result uses these costs exactly.

## 5. Cost sensitivity

The report MUST additionally evaluate the same frozen observations and decision logic under:

- baseline: fee ×1.0, slippage ×1.0;
- stress 1: fee ×1.5, slippage ×1.5;
- stress 2: fee ×2.0, slippage ×2.0.

No other parameter may change between these sensitivity runs.

These are cost-sensitivity diagnostics, not separate strategy variants.

## 6. Baselines

Every Phase 3 report MUST include, on the same applicable test period:

1. **No-trade baseline:** zero trades, zero realized return, zero drawdown attributable to strategy trades.
2. **Buy-and-hold baseline:** BTCUSDT buy-and-hold over the applicable evaluation interval, with its methodology and boundary timestamps stated explicitly.

The report MUST make clear whether strategy performance is superior to a trivial baseline and MUST NOT present a profitable strategy result as proof of live tradability.

## 7. Experiment registry

Every Phase 3 run is an immutable experiment-registry entry, including runs that fail, lose money, produce insufficient evidence, or otherwise disappoint.

Each entry MUST contain at least:

- experiment ID;
- UTC execution timestamp;
- ADR/protocol version;
- dataset artifact hash/version;
- exact dataset boundary;
- train/validation/test boundaries;
- holdout status;
- feature-definition versions;
- setup ID;
- research methodology version;
- horizon, targetR and invalidationR;
- fee/slippage/funding configuration;
- walk-forward/purge/embargo configuration;
- bootstrap/dependence-adjustment configuration;
- outcome counts and exclusions;
- report/artifact hash;
- terminal state / failure reason.

A run MUST be registered before its result is considered for comparison, and a failed run MUST remain registered.

No result may be deleted or overwritten to hide an unfavorable experiment.

## 8. Post-result changes

After a result has been observed, changing any protocol, dataset boundary, cost, funding treatment, outcome horizon, target/invalidation, split, purge/embargo rule, estimator configuration, evidence policy, or baseline methodology constitutes a new experiment.

It requires a new ADR before the new run.

Parameter changes MUST NOT be applied in place.

## 9. Red Team / stop-the-line conditions

This ADR does not relax `docs/RED_TEAM_RULES.md`.

Phase 3 is blocked if any of the following remains unresolved:

- look-ahead or PIT leakage;
- timestamp ambiguity;
- holdout contamination;
- unverifiable dataset/artifact identity;
- missing experiment-registry entry;
- silent data imputation;
- post-hoc parameter changes without a new ADR;
- cost/funding accounting ambiguity;
- unexplained divergence between the reported protocol and executed protocol.

## 10. Explicit non-decisions

This ADR does **not** add:

- indicators;
- features;
- live trading;
- credentials;
- execution;
- new signal families.

It freezes the research protocol required before Phase 3 implementation and execution.## 7. Success criterion

The Phase 3 verdict is **PAS D'EDGE** unless **all three criteria below pass separately on both validation and test**, with no reformulation after observing results. The validation set may not be used to tune any frozen parameter.

### Criterion 1 — dependence-adjusted Wilson vs cost-derived break-even

For each partition, compute the dependence-adjusted Wilson lower bound on the target-before-invalidation probability using the non-overlapping sample from Phase 2. Compare it to the break-even probability implied by the **actual per-trade costs in that partition**. The break-even probability is not a fixed magic number: for each observation it is derived from the target/invalidation payoff after its realized fee+slippage cost, and the partition threshold is the declared aggregate break-even probability for the same observation set. The criterion passes only if the adjusted Wilson lower bound is strictly greater than that cost-derived break-even threshold.

### Criterion 2 — cost-stressed block bootstrap

For each partition, under fee and slippage ×1.5, the 95% lower bound of the moving-block bootstrap mean of realizedR must be strictly greater than 0.

### Criterion 3 — random-entry null distribution

For each partition, run a declared fixed number of independent seeded random-entry draws. Every draw uses **exactly the same eligible timestamps and the same exits/targets/invalidation/horizon (ATR 1.5R / 1.0R / 8h), fees, slippage and funding accounting** as the strategy; only the entry side is randomized. The strategy's realizedR mean must be strictly greater than the **95th percentile** of that random-entry mean distribution. The number of draws and seed derivation are frozen before the run.

### Frozen declaration

- Random-entry draws: **1,000**.
- Master seed: **20261007**.
- Draw seed: deterministic `masterSeed + drawIndex`.
- Confidence level: **95%**.
- Bootstrap block size: **8 observations / 8h**, derived from the frozen outcome horizon.
- Bootstrap resamples: **2,000**.

Failure of any one criterion on validation or test yields exactly **`PAS D'EDGE`**. No alternative threshold, metric, partition, baseline, or interpretation may be substituted after results are observed.

## 8. Baselines

Every Phase 3 report MUST include:

1. **NO_TRADE:** zero trades and zero strategy return/drawdown.
2. **BUY_AND_HOLD:** BTCUSDT buy-and-hold over the same evaluation interval, with explicit semi-open UTC boundaries.
3. **RANDOM_ENTRY:** 1,000 fixed-seed draws using the same eligible timestamps and same exits/costs/funding as the strategy; report the full mean-distribution summary including its 95th percentile.
4. **ALWAYS_LONG:** LONG on the same eligible timestamps with the same exits/costs/funding.

The report MUST include results by calendar year and cost sensitivity at ×1, ×1.5 and ×2 for strategy and applicable baselines.


