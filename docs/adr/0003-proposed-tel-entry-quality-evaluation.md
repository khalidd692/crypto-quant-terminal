# Proposed ADR-0003 — TEL Spot entry-quality evaluation

- **Status:** PROPOSED — NOT ACCEPTED; no experiment authorized or launched
- **Draft date:** 2026-10-09
- **Owner approval required:** yes
- **Research result:** none
- **Relationship to ADR-0002:** strictly separate. This proposal does not amend, reinterpret, or reuse ADR-0002's frozen BTC futures dataset, historical outputs, or final holdout.

## 1. Question and falsifiable claim

Evaluate whether a pre-registered, point-in-time TEL Spot entry rule improves entry quality versus simple baselines after realistic execution costs. This is not a claim of profitability, not an execution system, and not evidence of an edge until the protocol is approved and the experiment is completed.

## 2. Primary outcome — freeze before inspecting results

For each eligible decision time, define the forward window as the next **N = 7 calendar days** (168 one-hour bars where coverage is complete). Let ATR(14) be computed using only data available at decision time. Define:

- `forward_min_low`: minimum low in the forward window;
- `distance_to_forward_low_ATR = (entry_reference_price - forward_min_low) / ATR14`;
- primary metric: median `distance_to_forward_low_ATR` among entry signals, with a block-bootstrap 95% confidence interval.

Lower is better. The entry reference, missing-data policy, fees, slippage and handling of bars that overlap a decision window must be frozen in the implementation protocol before the first authorized run. This draft proposes the metric and window; it does not claim that these choices are already approved.

Secondary descriptive measures: entry count, signal coverage, net return after costs at fixed horizons, maximum adverse/favorable excursion, drawdown, turnover, and proportion of entries followed by a further 1-ATR decline. None may replace the primary metric after results are seen.

## 3. Baselines

All baselines use the same point-in-time universe, availability constraints, decision timestamps, capital assumptions, execution-price convention and cost model:

1. **Random-entry baseline:** random eligible timestamps, matched to the rule's signal count and stratified by regime; fixed published seed(s).
2. **Daily-buy baseline:** one fixed-size Spot purchase at a predeclared UTC time each day.
3. **DCA baseline:** fixed amount at a predeclared cadence, with no price-timing discretion.

No baseline may be selected or discarded after observing results. Report all three, including unfavorable outcomes.

## 4. Point-in-time data and universe

- Use event-time and availability-time fields; a feature must not use information published after the decision timestamp.
- Preserve raw snapshots, source identifiers, timestamps, retrieval metadata and hashes.
- Include delisted, failed and severely impaired comparable assets to limit survivorship bias. Document inclusion/exclusion rules before forming the universe.
- Define a comparable-altcoin basket by predeclared liquidity, age, market-cap and listing-history criteria. Record failures and delistings rather than silently dropping them.
- Separate bull, bear and range regimes using a predeclared regime classifier; no regime boundaries may be tuned to improve outcomes.
- Record exchange fees, spread, market impact, slippage, and any applicable costs using defensible time-matched observations. If costs or data required for an observation are unavailable, mark the observation unusable; do not silently impute.

## 5. Untouched evaluation partition

Before any feature design, reserve **30% of this study's newly collected, versioned TEL Spot/comparable-asset dataset** as a one-time untouched evaluation partition. Hash and access-control the partition manifest before development. During design, it must not be loaded, summarized, plotted, queried, or used to choose features, thresholds, regimes, baselines or parameters.

This is a new study-specific partition, not ADR-0002's holdout. ADR-0002's dataset, holdout and historical results remain untouched. If the study-specific partition has already been inspected, the proposed untouched-evaluation claim is invalid and a new independently collected partition is required.

## 6. Dependence, inference and overlap

Signals and their forward windows overlap, so observations are not independent. Use a moving/stationary block bootstrap with block length at least the outcome horizon (168 hours), and report sensitivity to longer blocks. Resample at the asset/time-block level for the multi-asset panel. Report effective sample size and confidence intervals, not only point estimates.

TEL alone is unlikely to provide enough independent regimes or non-overlapping outcomes for a robust conclusion. Treat TEL-only results as descriptive unless the pre-registered minimum effective sample size is met; the comparable-asset panel is necessary for inferential claims.

## 7. Complexity budget

At most **two tunable parameters** may be evaluated. All other choices (horizon, feature definitions, universe, regime classifier, execution convention, costs, bootstrap, seed, missing-data rules) must be fixed in advance. No grid search, repeated holdout peeking, or unregistered parameter variants.

## 8. Pre-registered rejection criterion

Proposed rejection rule, requiring owner approval before execution:

Reject the entry rule as unsupported if either:
1. the upper bound of the block-bootstrap 95% confidence interval for improvement in the primary metric versus the matched random-entry baseline is not below zero; or
2. the improvement is not directionally consistent in at least two of the three predeclared regimes and the comparable-asset panel.

No post-hoc exception for a promising chart, single regime, or isolated TEL period. If the effective sample size is below the minimum fixed in the implementation protocol, classify the result as **INCONCLUSIVE**, not as evidence for or against an edge.

## 9. Minimum evidence and reporting

Before a run is authorized, the implementation protocol must set a numeric minimum effective sample size, minimum distinct assets, required coverage per regime, exact seeds, cost sources, block-bootstrap settings, and report schema. The report must include all exclusions by reason, all baseline results, all regimes, confidence intervals, and data/code hashes.

## 10. Stop conditions and explicit non-decisions

Stop without running if point-in-time timestamps cannot be verified, the universe omits failed assets without explanation, cost inputs are not defensible, the untouched partition is compromised, or any protocol decision remains unfrozen.

This proposal does **not** authorize data ingestion, backtests, parameter tuning, signal generation, or any change to the current verdict **PAS D'EDGE**. No dataset or holdout is read by this document. ADR-0002 and all Phase 3 historical artifacts remain immutable.
