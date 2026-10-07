# Phase 3 — Closure Report

## Verdict

**PAS D'EDGE.**

The Phase 3 result is reproducible and unchanged. The holdout remains virgin.

- Historical research run: unchanged.
- ADR-0002: unchanged.
- Holdout: not consumed.
- Development-only calibration test: consumed as development data; it is not a holdout evaluation.

## Immutable references

- PR #46 head SHA: `8991d67009164fbf9efb3ca09f06d75e4c1a0507`
- PR #46 merge commit: `097443523c7328e155caa8327a880f20daea9319`

## Diagnostics

Validation:
- Strategy mean R: **−0.2738745465**
- RANDOM_ENTRY diagnostic: **−0.2359** (reported historical diagnostic)
- ALWAYS_LONG diagnostic: **−0.2238** (reported historical diagnostic)

Test:
- Strategy mean R: **−0.2039716365**
- RANDOM_ENTRY diagnostic: **≈−0.204**
- ALWAYS_LONG diagnostic: **−0.2229**

RANDOM_ENTRY and ALWAYS_LONG are diagnostics outside the ADR-0002 contractual edge criteria.

Buy-and-Hold is a total partition return and is therefore not directly comparable with mean R per trade.

## Six reservations

1. **Criterion 1 is mis-calibrated by the cost-sign convention.** The reported break-even probability around 0.371 is incompatible with a positive cost under the stated +1.5R / −1R geometry.
2. **Cost sensitivity is inverted.** Historical sensitivity showed higher modeled costs improving mean R, which is not economically coherent.
3. **TIME_EXIT is excluded from criterion 1 but included in global mean R.** The two metrics therefore use different universes.
4. **Buy-and-Hold is a partition-level return, not a per-trade mean R.** It is a contextual baseline, not a unit-compatible comparison.
5. **RANDOM_ENTRY and ALWAYS_LONG are diagnostics outside ADR-0002.** They must be reported on both validation and test, not selectively on one partition.
6. **Simulator calibration remains methodological debt.** The controlled historical-geometry calibration reproduced approximately 30% target / 50% invalidation / 20% TIME_EXIT with ambiguous intrabar cases and produced gross mean R ≈ 0, but it does not reproduce BTC microstructure, funding, or the historical trajectory.

## Residual discrepancy

The historical deficit remains an **unexplained residual**, approximately **0.12–0.19 R per trade** relative to the no-drift/cost intuition used for the diagnostic comparison.

This is not treated as a measured simulator bug. Candidate explanations remain:
- exclusion of ambiguous observations;
- horizon-exit valuation;
- funding;
- duplicated or inconsistently signed fees/slippage.

No explanation is selected and no new strategy hypothesis is introduced.

## Cost-sign debt

The cost convention remains unfixed in the historical run:
- `feesReturn` and `slippageReturn` are not handled under one unambiguous cost-sign convention;
- criterion-1 break-even can become mathematically inconsistent with positive costs;
- cost sensitivity can move in the wrong direction.

**No retrospective correction is permitted.** Any correction requires a formal amendment of the methodology before a new research run.

## Calibration evidence

The deterministic historical-geometry calibration used:
- seed `20261007`;
- 100,000 observations;
- 8-candle horizon;
- +1.5R target;
- −1R invalidation;
- realistic intrabar high/low paths;
- ambiguous candles exercised.

Measured result:
- TARGET: 29,438 / 99,263 clean = **29.6566%**
- INVALIDATION: 49,592 / 99,263 = **49.9602%**
- TIME_EXIT: 20,233 / 99,263 = **20.3832%**
- AMBIGUOUS: 737 / 100,000 = **0.737%**
- gross mean R: **−0.0000415**

The earlier synthetic calibration remains in the repository as a separate development test.

## Exclusions

The immutable historical artifact exposes aggregate observation totals and outcome counts, but does not preserve the complete observation ledger needed to reconstruct every exclusion reason retrospectively. Therefore no unmeasured exclusion reason is invented here.

Known aggregate totals:
- Validation: 8,759 observations; 3,790 clean eligible; 52 ambiguous.
- Test: 17,536 observations; 8,964 clean eligible; 100 ambiguous.

## Closure status

Phase 3 is closed as **PAS D'EDGE** with the above methodological reservations.

No ADR-0003 is created.
No holdout data is accessed or consumed.
