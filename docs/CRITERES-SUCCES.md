# TEL prospective entry-quality test — success criteria

- **Document date:** 2026-10-09
- **Status:** Proposed preregistration; owner/reviewer acceptance required before the prospective test starts.
- **Minimum observation duration:** 8 complete weeks after acceptance.
- **Minimum sample:** 30 distinct eligible `ENTRER` signals. If fewer occur, outcome is **INCONCLUSIVE**; do not relax gates to obtain more signals.
- **Current conclusion:** **PAS D'EDGE**. This document is not evidence of an edge.

## Authorization boundary

No backtest, outcome scoring, parameter tuning, sealed-data access, or new strategy research is authorized by this document. The test may start only after explicit acceptance, a timestamped code SHA, a source/data manifest hash, and a frozen run configuration have been recorded. ADR-0002, its frozen dataset, historical results, and the Phase 3 holdout remain untouched.

## Primary metric

For each signal timestamp, calculate adverse excursion over the following 7 calendar days in ATR(14) units measured only from data available at signal time:

`adverse_ATR = max(0, (entry_price - minimum_future_low_7d) / ATR_at_entry)`

Lower is better. A missing ATR, incomplete future window, or ambiguous data interval is excluded only under a pre-written reason and counted in the exclusions report. Do not replace missing outcomes with zero.

## Baselines and secondary metrics

Compare against the same eligible time windows, venue assumptions and costs:
1. deterministic seeded random-entry baseline;
2. fixed-time daily-buy baseline;
3. fixed-calendar DCA baseline.

Report, for signal and every baseline:
- median and 25th/75th percentile adverse_ATR;
- favorable excursion in ATR units;
- net return after fees, spread and slippage, with cost assumptions and sensitivity;
- maximum adverse excursion, drawdown, and time to favorable excursion;
- counts of all decisions, unique signals, overlapping forward windows, missing outcomes and exclusions;
- angle availability rate, veto frequency, venue disagreement, and the rate of UNAVAILABLE data.

Do not treat overlapping 7-day outcomes as independent observations. Use the pre-registered block bootstrap and report 95% confidence intervals and effective independent episode count. Report bull, bear and range regimes separately using a deterministic rule frozen before evaluation.

## Minimum evidence and decision rule

A result is **PASS** only if every condition below holds:
1. at least 8 complete weeks and 30 distinct eligible ENTRER signals are observed;
2. the signal's median adverse_ATR is at least **0.10 ATR lower** than the strongest baseline;
3. the 95% block-bootstrap confidence interval for the improvement excludes zero in the favorable direction;
4. the improvement remains favorable after pre-registered realistic transaction costs;
5. the result is not solely attributable to one regime; all three regime results and their sample sizes are disclosed;
6. point-in-time provenance, missing-data accounting, privacy checks, and no-look-ahead tests all pass.

**REJECT** if the primary metric is no better than the strongest baseline after costs, if the confidence interval includes no improvement, or if integrity/privacy requirements fail. **INCONCLUSIVE** if the duration/sample minimum is not reached or if regime/sample coverage is insufficient. No threshold may be loosened after observing results to convert reject/inconclusive into pass.

## Parameter and data discipline

- Maximum 1–2 tunable parameters; preferably zero.
- Point-in-time source timestamps and raw snapshot hashes are mandatory.
- The proposed 30% chronological sealed segment in draft ADR-0003 is inaccessible during design and cannot be used for debugging or iteration.
- The comparable-asset basket must be fixed before study execution and include failures/delistings where verifiable.
- All failures, deviations and negative results remain preserved.
- No external whale signals or generic on-chain metrics may trigger entries.

## Required final report

Include protocol and code SHA, data-manifest hashes, exact UTC start/end, number of runs/signals, per-angle availability and veto frequencies, exclusions, all baselines, all three regime results, transaction costs, block-bootstrap intervals, overlap limitations, privacy/integrity checks, and one outcome: PASS / REJECT / INCONCLUSIVE.

## Invariants

No exchange orders are sent. This test does not alter ADR-0002, the frozen Phase 3 dataset, historical results, the untouched Phase 3 holdout, or the current **PAS D'EDGE** conclusion.
