# TEL cross-venue volume coherence policy

- **Effective date:** 2026-10-09
- **Scope:** operational data-quality guard only; not an entry signal and not an alpha threshold.
- **Venues:** KuCoin Spot and MEXC Spot, same TEL/USDT quote pair.
- **Current research conclusion:** **PAS D'EDGE**.

## Rule

For each run, calculate `max(volume24hQuote_KuCoin, volume24hQuote_MEXC) / min(...)`.

- If either volume is absent, non-finite, or non-positive: `UNAVAILABLE`; fail closed.
- If the ratio is greater than **5.0×**: `INCOHÉRENT`; fail closed and show both source values in the run diagnostics.
- Otherwise: `OK`, meaning only that the operational sanity check passed.

## Rationale and limitations

The 5× limit is a deliberately coarse anomaly-detection boundary intended to catch order-of-magnitude feed, symbol, quote-unit, or venue-market mismatches. It is not estimated from TEL returns, was not selected by backtest, and must not be interpreted as evidence of a trading edge. The same rule is applied symmetrically to both venues. If source semantics or quote units differ, the check is invalid and must be marked unavailable rather than silently normalized.

The limit is dated before any new prospective evaluation. Do not tune it against observed trading outcomes. Any change requires a dated change note explaining the source-semantic evidence and review before use.

## Invariants

No orders are sent. This policy does not change ADR-0002, its frozen dataset, historical results, or the untouched Phase 3 holdout; it does not change **PAS D'EDGE**.
