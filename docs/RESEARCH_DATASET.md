# Research Dataset Contract

## Purpose
The research dataset is an immutable, deterministic ledger of point-in-time observations. It is the evidence layer used before any empirical probability model is promoted.

## Observation unit
One row represents one instrument at one decision event (T0).

Each row records:
- event and availability timestamps;
- immutable dataset version;
- feature definition versions and feature-version policy;
- the complete feature snapshot available at T0;
- setup eligibility and side;
- entry reference price;
- target/invalidation policy in R;
- fixed future horizon;
- outcome label;
- MFE/MAE in R;
- realized R and return;
- fee, slippage and funding components;
- deterministic observation ID.

Non-signals are retained. They are not silently discarded.

## Point-in-time rule
Features are computed from points through T0 only. Future candles are used only by the outcome simulator.

A feature is admissible only when its declared availableTime is consistent with the dataset availability policy.

## Outcome policy
The simulator distinguishes TARGET, INVALIDATION, TIME_EXIT and AMBIGUOUS.

If target and invalidation are both touched within one OHLC candle and order cannot be inferred, the observation is AMBIGUOUS and is excluded from clean probability estimates.

MFE is non-negative R. MAE is non-positive R. Long and short signs are normalized through the side-aware simulator.

## Costs
Fees and execution slippage are explicit. Funding is a separate return component and must come from historical funding observations for derivatives research. A single cost must never be subtracted twice.

## Data integrity
Before research execution, the source series must be checked for:
- duplicate timestamps;
- monotonic event times;
- OHLC consistency;
- finite prices and non-negative volume;
- expected-interval gaps.

A dataset with integrity failures must not be promoted to a research dataset without an explicit exception recorded in its methodology version.

## Promotion rule
A positive backtest result is not sufficient for promotion. The research protocol must additionally pass:
1. chronological train/validation/test separation;
2. purge/embargo policy appropriate to label overlap;
3. untouched final holdout;
4. cost and slippage sensitivity;
5. ambiguity accounting;
6. baseline comparison;
7. ablation;
8. multiple-testing control;
9. reproducible dataset and feature hashes.