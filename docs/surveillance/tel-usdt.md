# Surveillance TEL/USDT

## Mission

Surveillance-only decision aid for TEL/USDT. It does not claim predictive power, does not estimate profit probability and does not place orders.

Primary source: **KuCoin Spot TEL/USDT**.
Secondary source: **MEXC Spot TEL/USDT**, used only for cross-checking.

## Decision states

Allowed states are ENTRER, ATTENDRE, SORTIR and NE_PAS_ENTRER.

Every output contains:
- the state;
- the exact conditions that produced it;
- configured levels and their source;
- risk-sizing result when computable;
- source and freshness information;
- the mandatory banner: « Règles de surveillance, aucun edge statistique démontré (phase 3 : PAS D'EDGE). Ce n'est pas une prédiction. »

## Safety / degraded data

The evaluator fails closed.

- KuCoin unavailable: NE_PAS_ENTRER.
- KuCoin stale: NE_PAS_ENTRER.
- MEXC unavailable: NE_PAS_ENTRER.
- MEXC stale: NE_PAS_ENTRER.
- KuCoin/MEXC price deviation above the configured cross-check threshold: NE_PAS_ENTRER.
- Invalid or missing mandatory levels/risk configuration: NE_PAS_ENTRER.

A degraded case can therefore never yield ENTRER. The implementation is intentionally conservative and does not invent fallback prices or thresholds.

## Entry conditions

ENTRER requires all of the following from configuration/data:
1. KuCoin data fresh and valid.
2. MEXC cross-check available and within configured deviation.
3. Price inside the configured entry zone.
4. Existing baseline trend condition is true.
5. Existing/configured volatility condition is true.
6. Configured gain/risk is at least 2.
7. Mandatory max-loss risk sizing is valid.

No new statistical threshold is introduced.

## Exit condition

If an existing LONG position has reached its configured exit/invalidation condition, the state is SORTIR. This is a deterministic risk/position state, not a prediction.

## ATTENDRE

When data is healthy but one or more entry conditions are not satisfied, the state is ATTENDRE.

## Position sizing

For spot long:

positionQuantity = maxLossQuote / abs(entryPrice - invalidationPrice)

notionalQuote = positionQuantity × entryPrice

No default capital or loss limit is invented.

## Non-goals

- No backtest claim.
- No edge claim.
- No probability of profit.
- No automatic order placement.
- No change to ADR-0002.
- No change to the historical Phase 3 result.
- No holdout access.
