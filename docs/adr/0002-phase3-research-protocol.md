# ADR-0002 — Phase 3 research protocol freeze

- **Status:** Accepted
- **Date:** 2026-10-07
- **Scope:** Phase 3 only — BTCUSDT, USDⓈ-M futures, 1h
- **Contract:** V1.2
- **Precondition:** This ADR MUST be committed before the first Phase 3 research run.
- **Amendment status:** Amended before any research run; no research result was observed before this amendment.
- **Amendment commit intent:** `amendé avant tout run, aucun résultat observé`.

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

The dataset boundary is event-time based, UTC, and semi-open `[start, end)`; every timestamp comparison in Phase 3 MUST use this convention. Research data must be loaded only through the fail-closed research loader.

## 2. Train / validation / test / holdout

The frozen chronological partitions are:

| Partition | Start | End | Purpose |
|---|---|---|---|
| Train | 2020-01-01 | 2023-01-01 | Estimation / model fitting |
| Validation | 2023-01-01 | 2024-01-01 | OOS policy/calibration selection |
| Test | 2024-01-01 | 2026-01-01 | Final development OOS evaluation |
| Final holdout | 2026-01-01 | 2026-10-01 | One-time final evaluation |

All boundaries are UTC and semi-open `[start, end)`. The purge is **8 hours** (8 × 1h outcome horizon), and the embargo is **8 hours**. The purge removes observations whose outcome window could cross a downstream training/test boundary; the 8-hour embargo prevents immediate post-test observations from entering the next training window while preserving a fixed, protocol-derived buffer. No arbitrary day-based embargo is permitted.

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
| Taker fee rate | 0.0004 per side (4 bps) |
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
3. **Random-entry baseline:** deterministic seeded random LONG/SHORT entries on exactly the same eligible timestamps, with the same horizon, target/invalidation, fees, slippage and funding accounting as the strategy.
4. **Always-LONG baseline:** LONG on exactly the same eligible timestamps, with the same horizon, target/invalidation, fees, slippage and funding accounting as the strategy.

All four baselines MUST expose the same report fields as the strategy where applicable: observation/trade count, mean/sum realized R, positive fraction, drawdown, target/invalidation hit rates, and annual breakdown. Baseline randomness MUST use a recorded fixed seed and MUST NOT be re-seeded after observing results.

The report MUST make clear whether strategy performance is superior to a trivial baseline and MUST NOT present a profitable strategy result as proof of live tradability.

## 7. Success criterion

Phase 3 is a success only if the frozen **test** interval satisfies all of the following, using the dependence-aware uncertainty already required by Phase 2:

1. the 95% lower bound of mean realized R is **> +0.05R**;
2. mean realized R is at least **+0.10R** and exceeds both the deterministic always-LONG baseline and the fixed-seed random-entry baseline by **≥ 0.05R**;
3. mean realized R remains **> 0** under the ×1.5 fee/slippage stress;
4. buy-and-hold is reported on the identical test boundaries as a contextual baseline, but is **not** compared to R-denominated strategy returns because the units are not identical.

Failure of any criterion is a valid negative result and does not authorize protocol changes.

## 8. Holdout isolation and hash

The final holdout dataset is a separate artifact from the research dataset. Its manifest MUST contain its content hash and exact semi-open UTC boundaries. The research loader MUST reject any market-data or observation timestamp `>= 2026-01-01T00:00:00.000Z`; this is a fail-closed boundary, not merely a caller convention. A dedicated automated test MUST prove that rejection.

The holdout artifact is loaded only by the one-time holdout script. `npm run research` MUST never load the holdout artifact or its manifest.

## 9. Experiment registry

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

## 10. Post-result changes

After a result has been observed, changing any protocol, dataset boundary, cost, funding treatment, outcome horizon, target/invalidation, split, purge/embargo rule, estimator configuration, evidence policy, or baseline methodology constitutes a new experiment.

It requires a new ADR before the new run.

Parameter changes MUST NOT be applied in place.

## 11. Red Team / stop-the-line conditions

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

## 12. Explicit non-decisions

This ADR does **not** add:

- indicators;
- features;
- live trading;
- credentials;
- execution;
- new signal families.

It freezes the research protocol required before Phase 3 implementation and execution.
