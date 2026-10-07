# Architecture Decisions

## ADR-001 — Read-only V1

V1 produces decisions and simulations only. Live trading is explicitly out of scope.

Reason: validate statistical and execution assumptions before introducing capital-risking actions.

## ADR-002 — Decision states include NO_TRADE and INSUFFICIENT_EVIDENCE

Reason: a forced LONG/SHORT classification creates false certainty.

## ADR-003 — Liquidity is a gate, not a score

Reason: an attractive theoretical setup can be unexecutable.

## ADR-004 — Invalidation is distinct from stop

Reason: analytical thesis failure and execution risk control are different concepts.

## ADR-005 — Probabilities require empirical grounding

Reason: arbitrary scores are not probabilities and cannot be calibrated or falsified.

## ADR-006 — Version everything that can alter a decision

Reason: reproducibility requires exact reconstruction of the decision context.

## ADR-007 — V1 favors a small feature set

Reason: reduce degrees of freedom and overfitting while establishing a reliable measurement baseline.

## ADR-008 — GitHub is the source of truth

Implementation changes are version-controlled. Architecture changes require explicit documentation and review.
