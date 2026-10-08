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


## Addendum — Phase 3 diagnostics and versioned funding archive

### Diagnostic export

PR #53 merged as `039892c562ea768253b2da13da9fb8e2a328ecfa`.

On frozen dataset `sha256:6684d0e7bfb27080430164729e6aa8ac556ac09a728f373eeb32ef3b4781abce`:
- Validation: 8,759 observations / 3,790 clean eligible / 52 ambiguous / 4,917 non-ambiguous exclusions.
- Test: 17,536 observations / 8,964 clean eligible / 100 ambiguous / 8,472 non-ambiguous exclusions.
- All measured non-ambiguous exclusions are `SETUP_NON_ELIGIBLE`; no other requested exclusion category was observed.
- Warm-up and tail remain outside the ledger: 50 and 8 observations.
- Strategy gross state means: validation TARGET 1.175456 / INVALIDATION −1.322057 / TIME_EXIT −0.185503; test TARGET 1.212117 / INVALIDATION −1.285224 / TIME_EXIT −0.151064.
- RANDOM_ENTRY gross state means: validation TARGET 1.168500 / INVALIDATION −1.318539 / TIME_EXIT −0.109052; test TARGET 1.214028 / INVALIDATION −1.287649 / TIME_EXIT −0.055052.

No holdout observation was accessed and no historical result was rewritten.

### Versioned funding archive

PR #54 merged as `e0d7b2ccc63d4d90e7d1833732a2cd550276b359`.

- Source: Binance Vision USDⓈ-M Futures monthly `fundingRate`.
- Symbol: BTCUSDT.
- Period: 2020-01 through 2025-12, end-exclusive at 2026-01-01.
- Files: 72 monthly ZIP archives.
- Funding rows: 6,576.
- Canonical archive manifest SHA-256: `137d7f4f0d41fbdae1b93d9aa3b50cf3193e91630eb46fc09262d8a53fbeaf8a`.
- GitHub Actions artifact digest: `sha256:64b0178da2636fdb0f213faae9b7dc44ec8881c2bf711ff6a1c0eb52be4f0241`.
- Freeze workflow: #2 green; CI: #335 green.

The loader fails closed on manifest mismatch, missing files, or per-file SHA-256 mismatch. The altered-archive test is expected to fail and does fail; the correct archive and replay inputs are reproducible.

The current replay remains explicitly labelled **non reconstructible bit-à-bit pour le net historique** because the exact funding snapshot used by the original immutable result was not versioned at that time. The frozen archive enables reproducible future replay without rewriting the historical result.

### TEL/USDT surveillance

PR #52 merged as `ae6d59b51df3a274cfc8383e69a290c1865eb0da`.

The surveillance layer is read-only and uses KuCoin Spot TEL/USDT as primary source and MEXC Spot TEL/USDT as cross-check. It implements ENTRER / ATTENDRE / SORTIR / NE_PAS_ENTRER, explicit condition/level reporting, fail-closed degraded-data handling, and the mandatory non-predictive banner.

Surveillance CI: #343 green.

### Remaining reservations intentionally not treated

1. **Criterion 1 definition remains to be clarified by a future ADR.** No ADR-0003 is created here.
2. **Residual discrepancy of approximately 0.12–0.19 R remains unexplained.** No explanation is selected and no parameter is optimized.
3. **The Phase 3 test partition is consumed as development/OOS evidence.** It is not a virgin holdout; the final holdout remains untouched and unconsumed.
4. **Exact historical net state means remain non-reconstructible bit-for-bit** because the original funding snapshot was not persisted.

These reservations remain deliberately unresolved; resolving them would require a separately authorized methodological change.
