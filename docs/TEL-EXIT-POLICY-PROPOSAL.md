# Proposed TEL SPOT exit policy — defaults frozen before any evaluation

- **Status:** Proposal only; not wired into the decision engine; not validated.
- **Draft date:** 2026-10-09
- **Applies to:** prospective TEL SPOT swing-plan design only.
- **Research status:** no backtest or outcome analysis authorized by this document.
- **Current conclusion remains:** **PAS D'EDGE**.

These values are proposed design defaults, not a claim of profitability and not an instruction to trade. They must be reviewed and accepted before any prospective evaluation. They must not be tuned after viewing results.

## Proposed defaults

| Rule | Proposed default | Exact semantics |
|---|---:|---|
| ATR reference | ATR(14), 1h candles | Calculate using only candles available at entry; record value and source hash |
| Catastrophe stop | Entry − 3.0 × ATR at entry | Fixed level written before entry; never automatically widened or moved down |
| Target 1 | Entry + 1.5 × ATR at entry | At first touch, record event and reduce 25% of original position |
| Target 2 | Entry + 3.0 × ATR at entry | At first touch, record event and reduce another 25% of original position |
| Time reduction | 5 × 24 h if target 1 has not been reached | Reduce 25% of original position once; do not repeat the reduction on every run |
| Trailing stop activation | Only after target 1 | Applies only to the remaining position |
| Trailing stop distance | 2.0 × current ATR(14) | Candidate stop = reference price − 2.0 × ATR; use only if it is higher than the existing stop |
| Stop update direction | Favorable only for a long SPOT position | New stop must be strictly higher than the previous stop; equal/lower candidates are rejected |
| Multiple event collision | Catastrophe stop takes priority | Never assume the target was hit first if candle data cannot establish order |
| Missing/stale ATR or price | UNAVAILABLE | Do not invent levels or silently reuse stale values |

All percentages are reductions of the **original position quantity**, so the 25% target-1 reduction plus the 25% target-2 reduction leaves 50% for a trailing stop. If a target and stop appear to be crossed in the same candle and finer-grained data cannot disambiguate order, record AMBIGUOUS and do not assume the favorable sequence.

## Mandatory journal events

Every position-plan creation and every proposed/accepted/rejected stop change must record:
- UTC timestamp and position reference (non-identifying local reference only);
- entry price and quantity reference, ATR value, ATR source timestamp/hash;
- catastrophe stop and target levels fixed at entry;
- event type: TARGET_1, TARGET_2, TIME_REDUCTION, CATASTROPHE_STOP, TRAIL_CANDIDATE, STOP_RAISED, STOP_CHANGE_REJECTED, or UNAVAILABLE;
- old stop, candidate stop, new stop, and reason;
- remaining quantity after any reduction;
- data freshness/provenance and ambiguity flags.

Do not place private position values in public Pages, public artifacts, source files, or ordinary CI logs. Any private position journal must remain outside the public repository and artifacts.

## Invariants

- No exchange orders are sent by this tool.
- A plan is informational; it cannot guarantee stop execution or prevent losses.
- No stop may be loosened for a long position.
- No exit parameter may be optimized from observed results without a separately accepted protocol.
- This policy does not change ADR-0002, its frozen dataset, historical results, or the untouched Phase 3 holdout.
- It does not change **PAS D'EDGE**.

## Acceptance required before implementation/evaluation

- [ ] Owner accepts or rejects each proposed default.
- [ ] Independent reviewer confirms event ordering, gap-through-stop behavior, partial-reduction semantics, and missing-data handling.
- [ ] Privacy test proves no private position data can enter public HTML, artifacts, logs, or repository files.
- [ ] Only then may a separate implementation PR be opened; no historical analysis or parameter tuning is implied by acceptance.
