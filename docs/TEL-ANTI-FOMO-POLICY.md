# TEL anti-FOMO extension guard — preregistered display defaults

- **Date:** 2026-10-09
- **Scope:** informational pre-trade caution and decision veto only; no exchange control.
- **Current conclusion:** **PAS D'EDGE**.

## Trigger rules

The screen marks the anti-FOMO angle as triggered when any of these conditions holds:
- existing P0 entry-quality assessment is `EXTENDED` (its existing EMA/VWAP/RSI/24h/7d rules; unchanged);
- price is more than **2.0 × ATR(14)** above EMA200 or anchored/current VWAP, where all values use only data available at decision time;
- price has risen more than the existing P0 `maxRise24hPct = 8%` threshold over 24 hours or 48 hours.

The 2.0 ATR guard is a conservative display/veto threshold, not a profitability parameter. The 8% rise threshold is reused from the existing dated P0 policy; it is not optimized or relaxed for the 48h window. These are prospective operational defaults and must not be tuned after observing outcomes. The delay remains configurable from 12 to 24 hours and still requires a written motive; motive content is private and is not emitted to public HTML or the journal.

## Invariants

No order is sent or blocked on the exchange. This policy does not modify the underlying P0 indicator thresholds, ADR-0002, frozen data, historical results, Phase 3 holdout, or **PAS D'EDGE**.

## Anchored VWAP methodology (monitoring-only)

The anti-FOMO extension guard also checks VWAP anchored to the latest confirmed swing low in the available 1-hour KuCoin candles. A swing-low pivot uses 3 candles on the left and 3 on the right; only pivots whose right-side confirmation candles are already present are eligible. The search is bounded to the latest 168 candles. VWAP uses typical price `(high + low + close) / 3`, weighted by candle volume, from the pivot candle through the decision candle. If there is no confirmed pivot or any required candle/volume value is invalid, this component is unavailable and does not fabricate a value. A price more than 2.0 ATR(14) above this anchored VWAP adds the existing informational anti-FOMO caution; it does not place, cancel, or block an exchange order. Existing P0 rolling-VWAP and EMA200 rules are unchanged.
