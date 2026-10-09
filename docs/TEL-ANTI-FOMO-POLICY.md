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
