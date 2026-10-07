# Validation Protocol V1.2

## Goal

Determine whether the terminal has a repeatable out-of-sample edge rather than a hindsight-optimized pattern.

## Required sequence

1. Freeze a dataset version.
2. Define the observation unit.
3. Define labels/outcomes before model fitting.
4. Split chronologically.
5. Apply purge/embargo where observations overlap.
6. Train only on information available before each evaluation period.
7. Run walk-forward evaluation.
8. Evaluate on untouched OOS data.
9. Preserve a final holdout that is not used for iteration.
10. Report costs, slippage and funding assumptions.
11. Compare against simple baselines.
12. Run feature/setup ablations.
13. Record every experiment.

## Leakage checks

Reject any implementation that uses:

- future candles
- future extrema
- future normalization statistics
- labels or outcomes to construct contemporaneous features
- signal-dependent feature definitions
- survivorship-biased asset universes without disclosure

## Baselines

At minimum compare against:

- no-trade
- buy-and-hold where meaningful
- simple trend/momentum baseline
- simple volatility/risk baseline

## Metrics

Report metrics appropriate to the decision objective, including:

- hit rate
- payoff distribution
- expectancy
- drawdown
- volatility-adjusted performance
- turnover
- cost sensitivity
- calibration where probabilities are emitted
- performance by regime
- performance by liquidity bucket

No single metric is sufficient.

## Multiple testing

Maintain an experiment registry containing hypotheses, dataset version, feature/model versions, evaluation windows and results. Selection effects must be disclosed.

## Acceptance rule

A strategy is not promoted merely because one backtest is profitable. Promotion requires consistent OOS evidence, robustness to reasonable cost/slippage perturbations, and no unresolved leakage or definitional contradictions.
