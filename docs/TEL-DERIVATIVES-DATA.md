# MEXC TEL perpetual derivatives — secondary context

- **Scope:** descriptive monitoring only; never an entry trigger and never a replacement for spot liquidity checks.
- **Contract:** `TEL_USDT` perpetual on MEXC.
- **Sources:** MEXC public futures API funding-rate endpoint, ticker endpoint, and contract-detail endpoint.
- **Funding unit:** raw decimal fraction as returned by MEXC (for example, 0.0002 means 0.02%).
- **Open interest quote notional:** `holdVol × contractSize × fairPrice`, using contract size returned by the contract-detail endpoint. If any input is missing or invalid, the value remains `UNAVAILABLE`.
- **Freshness:** funding/ticker timestamp must be no older than 15 minutes and no more than 5 minutes in the future.
- **Failure policy:** HTTP errors, wrong symbol, invalid schema, stale timestamps, or missing contract size do not get imputed. The existing BTC derivatives fields remain separate and unchanged.
- **Safety:** no exchange orders, no leverage, no parameter tuning, no backtest. This context cannot override a spot liquidity veto or any other veto. ADR-0002, frozen dataset, historical results, holdout, and **PAS D'EDGE** are unchanged.
