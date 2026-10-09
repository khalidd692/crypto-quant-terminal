# TEL Spot — default exit policy (proposed, fixed before use)

- **Date frozen for this implementation:** 2026-10-09
- **Status:** documented defaults; no optimization performed
- **Scope:** prospective Spot swing position management only; no order execution
- **Research status:** these are risk-management defaults, not an edge claim

## Defaults

| Rule | Default |
|---|---:|
| Catastrophe stop | Entry minus 2.0 × ATR(14), set before entry |
| Target 1 | Entry plus 1.5 × ATR(14); reduce 1/3 of initial quantity |
| Target 2 | Entry plus 2.5 × ATR(14); reduce another 1/3 of initial quantity |
| Remainder | Final 1/3 may use a trailing stop at 2.0 × ATR(14) below the best price since target 2 |
| Time component | If target 1 has not been reached after 7 calendar days, reduce 1/3 of remaining quantity once |
| Stop movement | Catastrophe stop never loosens; ATR trailing stop applies only to remainder and can only rise for a long Spot position |

The initial catastrophe stop is stored with the entry plan and must not be recalculated from a later ATR. The trailing stop is separate and applies only to the remaining quantity after target 2. Stop updates must be appended to the prospective journal with old stop, proposed stop, reason, timestamp, source ATR and a monotonicity check. Reject any update that lowers the stop for a long position. Never place or modify exchange orders from this module.

## Important qualifications

These numbers are deliberately fixed defaults for implementation review, not empirically optimal parameters. They must not be changed after observing prospective results without a new dated decision record. The time reduction and targets may generate multiple reductions; quantities must be capped at the current remaining position and each event must be idempotent. This document does not imply that any stop is currently placed at an exchange.

