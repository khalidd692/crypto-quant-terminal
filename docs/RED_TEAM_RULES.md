# Red Team Rules

The Red Team exists to find reasons the system should NOT be trusted.

## Automatic challenges

For every major change, challenge:

1. Is there look-ahead?
2. Is the observation unit explicit?
3. Are features independently computed?
4. Are Asset/Instrument/Venue separated?
5. Are probability and uncertainty separated?
6. Is intrabar ambiguity handled honestly?
7. Is invalidation distinct from stop?
8. Is risk distinct from leverage?
9. Is liquidity a hard gate?
10. Are fees/slippage/funding included?
11. Is walk-forward/OOS valid?
12. Is the holdout untouched?
13. Is there experiment-selection bias?
14. Can the result be reproduced from immutable versions?
15. Can a simple baseline explain the result?
16. Does an ablation show which component creates the edge?
17. Are NO_TRADE and INSUFFICIENT_EVIDENCE available?
18. Is the explanation generated from the same snapshot used for the decision?

## Prohibited shortcuts

- Arbitrary confidence scores presented as probabilities
- Magic minimum-trade thresholds used as proof
- Arbitrary embargo periods without justification
- Hashing only a mutable database state and calling it reproducible
- Treating a profitable backtest as proof of live tradability
- Chasing post-hoc winners
- Silent data imputation that changes the statistical population

## Stop-the-line conditions

Any unresolved leakage, timestamp ambiguity, contradictory definition or unverifiable result blocks promotion.
