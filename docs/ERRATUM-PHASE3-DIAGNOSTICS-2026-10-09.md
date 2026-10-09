# Erratum — Phase 3 diagnostic gross-return accounting

**Date:** 2026-10-09  
**Scope:** diagnostic code only; this erratum does not amend the historical Phase 3 result, ADR-0002, the frozen dataset, or the closure report.

## Finding

The Phase 3 diagnostic path reconstructed gross return from a value that was already net of fees (and whose slippage effect is represented separately with a signed convention). Subtracting costs again made the diagnostic gross/net comparison invalid. The corrected diagnostic reconstructs the no-fee, no-slippage return as:

`grossReturnFraction = returnFraction + feesReturn - slippageReturn`

Here `returnFraction` is already net of fees; `slippageReturn` is the signed difference between slipped and slippage-free return. Thus the cost reconciliation, excluding funding, is:

`grossReturnFraction - returnFraction = feesReturn - slippageReturn`

Fees and slippage are reported as positive cost magnitudes in R. Funding is reported separately with its signed payment convention and is not folded into gross return.

## Boundaries and invariants

- This correction is limited to `src/research/phase3-diagnostics.ts` and its tests/export fields.
- `src/risk/tel-position.ts` remains the source for position P&L and its net result. Diagnostic gross return must never feed the decision tool.
- No frozen artifact is rewritten. No change is made to `docs/phase3-closure-report.md`, ADR-0002, or the frozen dataset.
- The Phase 3 verdict remains **PAS D'EDGE**. This is a reporting correction, not new evidence of an edge.
- No final holdout data is accessed.
