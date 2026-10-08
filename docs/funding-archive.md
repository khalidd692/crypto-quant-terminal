# Frozen Phase 3 funding archive

The Phase 3 replay uses a versioned BTCUSDT USDⓈ-M Futures funding archive covering 2020-01 through 2025-12, end-exclusive at 2026-01-01.

The source is Binance Vision monthly fundingRate archives. Each ZIP is verified against Binance's published .CHECKSUM, and manifest.json records source URL, month, row count and SHA-256 for every archive plus a canonical archive hash.

The replay must be run with PHASE3_FUNDING_DIR pointing at this frozen artifact. The loader fails closed if the manifest schema, symbol or period is wrong, the canonical manifest hash is wrong, a listed ZIP is missing, or any ZIP SHA-256 differs from the manifest.

The archive ends at 2026-01-01 and therefore does not include or access the final holdout interval.

The current replay remains explicitly separate from the immutable historical Phase 3 result: non reconstructible bit-à-bit pour le net historique until the exact historical funding archive used by that original run is identified. The frozen archive makes future replays reproducible; it does not rewrite the historical result.

The CI workflow publishes the frozen archive as a GitHub Actions artifact and records its artifact digest. The artifact is a reproducibility input, not a new research result.
