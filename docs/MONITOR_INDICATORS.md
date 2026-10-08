# Monitor indicators (monitor-v1)

Descriptive market context for the surveillance tool. Implemented in `src/features/monitor-indicators.ts`.

## Status and limits

- Separate from `core-v1` (`feature-engine.ts`). core-v1 feeds the frozen Phase 3 research and the frozen terminal estimator and must never change. A test guards its ids and versions.
- Not wired into probability, expectancy, decision or research code.
- Not validated predictors. Phase 3 verdict stays PAS D'EDGE. ADR-0002, the frozen dataset and the holdout are untouched.
- Point-in-time: only the points passed in are read; the last point is the decision candle.
- A feature without enough history is `null`. Nothing is imputed.

## Indicators

| Feature id | Family | Definition | Min candles |
| --- | --- | --- | --- |
| `trend.price_vs_ema200` | trend | close / EMA(200) - 1, SMA-seeded EMA | 200 (use 300+) |
| `trend.adx` | trend | Wilder ADX, 14 | 28 |
| `trend.di_spread` | trend | +DI minus -DI, 14 | 28 |
| `momentum.macd_hist_norm` | momentum | MACD(12,26,9) histogram / close | 34 |
| `momentum.stoch_rsi` | momentum | RSI(14) position in its 14-candle range, 0 to 1 | 28 |
| `volatility.bb_percent_b` | volatility | Bollinger(20, 2, population sd) %B | 20 |
| `volatility.bb_bandwidth` | volatility | (upper - lower) / middle | 20 |
| `volume.obv_trend` | volume | OBV change over 20 candles / 20-candle volume, in [-1, 1] | 21 |
| `volume.vwap_deviation` | volume | close / rolling 24-candle VWAP - 1 (typical price) | 24 |
| `structure.donchian_position` | structure | close position in the prior 20-candle channel (current candle excluded) | 21 |
| `structure.support_distance` | structure | (close - nearest confirmed swing low) / close | 7 |
| `structure.resistance_distance` | structure | (nearest confirmed swing high - close) / close | 7 |

Swing pivots (3 left, 3 right, lookback 100): a pivot is confirmed only 3 candles later, so the latest 3 candles are never pivots.

## Conventional readings (not validated on this project's data)

- ADX above 25: established trend; below 20: weak trend. Direction comes from `di_spread`.
- MACD histogram: sign gives direction of momentum, its change gives acceleration.
- Stochastic RSI above 0.8 or below 0.2: stretched momentum.
- %B above 1 or below 0: close outside the bands. Low bandwidth: compressed volatility.
- OBV trend and VWAP deviation: whether volume agrees with price.
- Donchian position above 1 or below 0: close broke the prior channel.

These are common trader conventions used to label the screen. They are not signals and carry no demonstrated edge.

## Verification

`tests/monitor-indicators.ts` compares MACD, Bollinger, ADX/DI, Stochastic RSI, OBV and EMA(200) with TA-Lib 0.8.1, and VWAP, Donchian and swing pivots with independent numpy code, on a deterministic 400-candle series (max difference about 2e-11). It also covers short history, flat or zero-volume input, no look-ahead on pivots, and the frozen core-v1 contract.
