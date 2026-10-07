# Research Protocol

## Baseline

The repository contains a deliberately simple baseline setup:

- EMA(20) / EMA(50) relationship
- RSI(14)
- realized volatility
- ATR-derived target/invalidation
- fixed evaluation horizon
- explicit fees and slippage
- ambiguous intrabar outcomes excluded from clean probability estimates

This is a research baseline, not a production strategy.

## Probability

The empirical target probability is estimated only from observed baseline outcomes. The current live terminal intentionally has no predictive probability model and therefore returns INSUFFICIENT_EVIDENCE.

Wilson intervals are reported separately from the point estimate.

## No hindsight

For each baseline observation, features are computed from candles up to and including T0 only. Future candles are passed only to the outcome simulator.

## Intrabar ambiguity

If target and invalidation are both touched inside the same OHLC candle, the outcome is marked ambiguous rather than inventing an execution order.

## Promotion

A baseline can only become a candidate production model after:

1. frozen dataset version;
2. predefined train/validation/test windows;
3. justified purge/embargo;
4. walk-forward evaluation;
5. untouched final holdout;
6. cost/slippage sensitivity;
7. calibration analysis;
8. regime and liquidity breakdown;
9. baseline/ablation comparison;
10. experiment registry review.

No profitable single run is sufficient.
