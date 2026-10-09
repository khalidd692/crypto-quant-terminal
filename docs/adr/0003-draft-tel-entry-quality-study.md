# ADR-0003 (DRAFT) — Prospective study of TEL entry quality

- **Status:** Draft — NOT accepted; no experiment authorized
- **Draft date:** 2026-10-09
- **Decision owner:** User
- **Review required:** Claude / independent reviewer
- **Scope:** A future study of spot TEL entry timing only
- **Current conclusion remains:** **PAS D'EDGE**. This draft is not evidence of an edge.

## 0. Authorization boundary

This document is a proposal only. Do not start a backtest, download or score research data, create a result registry entry, inspect the final study holdout, tune parameters, or alter the current entry pipeline as part of this ADR. No research is authorized until this ADR is reviewed, accepted, and all data manifests and success criteria are frozen.

This draft does not amend ADR-0002. ADR-0002, its frozen dataset and historical results, and the untouched Phase 3 holdout remain immutable. The Phase 3 BTCUSDT futures protocol is separate from this proposed TEL spot study.

## 1. Research question

Does a pre-registered, point-in-time TEL spot entry-quality rule improve entry location relative to simple non-predictive baselines, after realistic execution costs, across distinct market regimes and beyond one asset?

The study evaluates timing quality, not a claim that TEL must recover, not a price target, and not permission to trade. TEL-only evidence cannot establish a robust general edge.

## 2. Primary outcome — freeze before data inspection

**Proposed primary metric:** for each eligible entry at time t, calculate the adverse distance from entry price to the minimum low over the next N days, in ATR units known at t:

`adverse_ATR = max(0, (entry_price - min_future_low_N_days) / ATR_at_entry)`

- Candidate horizon: N = 7 calendar days. This value must be explicitly accepted or replaced before any dataset is opened.
- ATR must be computed solely from observations available at the decision timestamp.
- Report the full distribution and median, not only the mean; also report favorable excursion and net return as secondary outcomes.
- The exact event-time, candle-boundary, missing-data, and stop/target ambiguity rules must be frozen before the study.
- Never select N, ATR convention, or the preferred metric after seeing outcomes.

## 3. Baselines

Evaluate the same eligible timestamps, costs, and observation windows against:
1. **Random-entry baseline:** deterministic seeded random timestamps sampled within each eligible regime and calendar window.
2. **Daily-buy baseline:** buy at a pre-specified daily UTC time, irrespective of the entry-quality signal.
3. **DCA baseline:** a fixed calendar schedule and fixed tranche size, specified before data inspection.

The sampling seed, schedule, eligible windows, and capital allocation must be versioned. No baseline may be weakened after seeing results.

## 4. Point-in-time data and survivorship control

- All features and source records must have an auditable availability timestamp; only information available at the decision time may be used.
- Store source URL/provider, collection timestamp, event timestamp, raw snapshot hash, parsing version, and missingness reason.
- No backfilled data that were unavailable at the time may be treated as point-in-time.
- Freeze the universe and inclusion/exclusion rules before outcomes are computed.
- Define a comparable-altcoin basket before the run. It must include failed, delisted, abandoned, or materially impaired projects where reliable data can be obtained; do not select survivors only.
- If a comparable's history or delisting data cannot be verified, record the limitation and exclude it under the pre-written rule rather than silently replacing it.

## 5. Regime separation

Define bull, bear, and range regimes using a published, deterministic rule and only information available at each decision timestamp. Freeze the exact rule and parameters before opening outcome data. Report results separately by regime and overall; do not let a strong regime conceal failure in another.

## 6. Development / sealed data split

- Proposed split: 70% chronological development data and 30% sealed evaluation data.
- The 30% evaluation segment must be chosen and hashed before development, stored separately, and inaccessible to feature design, threshold selection, debugging, and reviewer iteration.
- No plots, summary statistics, labels, samples, or aggregate metrics from the sealed segment may be exposed during design.
- Access is allowed only once after the protocol, code, parameter values, costs, baselines, and rejection criterion have been frozen and independently reviewed.
- This proposed 30% split is distinct from and does not replace or unlock the Phase 3 holdout.

## 7. Realistic costs and execution assumptions

- Spot only; no leverage.
- Use venue-specific historical spread, depth/impact and fees when verifiable.
- Where historical execution data are unavailable, apply a conservative, pre-registered cost model and report that limitation; do not imply measured fills.
- Include buy and sell fees, spread, slippage/market impact, and any applicable venue constraints consistently across the signal and baselines.
- Do not assume fills for limit orders merely because the market touched a price unless queue/fill assumptions are explicitly modeled and validated.

## 8. Dependence and uncertainty

- Use a block bootstrap with block length and resampling count specified before outcome inspection.
- Report confidence intervals and the effective number of independent episodes.
- Explicitly disclose overlapping forward windows and dependent observations. Do not treat each overlapping signal as an independent sample.
- Perform sensitivity analysis only for pre-registered assumptions; no post-hoc parameter sweep.
- At most **one or two tunable parameters** may be proposed. Prefer zero tuning. All other definitions are fixed before the study.

## 9. Pre-written rejection rule

**Proposed rule, requiring explicit approval before execution:** reject the entry-quality hypothesis if the primary metric does not improve over the strongest baseline by a pre-specified minimum effect, or if the uncertainty interval includes no improvement, or if the result depends on a single regime/asset, or if realistic costs erase the advantage, or if point-in-time/survivorship integrity fails.

The minimum effect size, confidence level, and multiplicity handling are intentionally marked **NOT YET APPROVED**. They must be chosen and dated before any outcome data are inspected. They must not be selected from observed results.

Any leakage, sealed-set exposure, unverifiable data provenance, or protocol deviation invalidates the study rather than being patched after the fact.

## 10. Reporting requirements

The final report must include:
- immutable protocol ID, code SHA, dataset and source-manifest hashes;
- exact UTC boundaries, PIT availability checks, missing-data and exclusion counts;
- all baselines and cost assumptions;
- overall, bull, bear, and range results;
- results for the full pre-registered comparable basket, including failures;
- primary metric distributions, effect sizes, uncertainty intervals, block-bootstrap method, and overlap limitations;
- transaction-cost sensitivity and conservative limit-fill assumptions;
- sealed-set access audit and a clear pass/reject/inconclusive outcome;
- all failed runs and deviations, without overwriting unfavorable results.

## 11. Explicit non-decisions

This draft does not:
- authorize any research or backtest;
- create an ADR-0003 accepted decision;
- alter ADR-0002, the frozen dataset, historical results, or any holdout;
- change thresholds or production decision logic;
- assert an edge or change **PAS D'EDGE**;
- authorize live trading or exchange execution.

## 12. Acceptance checklist

Before any future study:
- [ ] Owner accepts this ADR and fills all **NOT YET APPROVED** fields.
- [ ] Reviewer confirms metric, regime rule, baselines, costs, block bootstrap, and rejection criterion are fully specified.
- [ ] Development and sealed evaluation manifests are hashed; sealed segment access is technically restricted.
- [ ] Comparable-asset universe includes pre-defined failure/delisting treatment.
- [ ] Code and protocol are frozen and independently reviewed.
- [ ] A separate explicit authorization to execute the study is recorded.
