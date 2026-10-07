# Data Provider Contract

## V1 provider

The first concrete provider is Binance public market data.

The adapter is read-only and uses public REST endpoints. No API key or trading credential is required for the V1 research path.

### Spot

Public market-data endpoints use Binance's public data API.

### USDⓈ-M futures

The adapter supports:

- klines
- best bid/ask
- funding-rate history
- open interest

These are market-data reads only.

## Point-in-time policy

The provider must never treat an open candle as closed.

The adapter discards a kline whose close timestamp is still in the future at receipt time.

availableTime is modeled as:

closeTime + assumedAvailabilityLag

The lag is an explicit configuration parameter and must be versioned for research. A zero lag is an optimistic assumption and must not be confused with measured feed latency.

## Rate limits and failure behavior

Provider errors are surfaced. They are not silently converted into missing values.

Retries, pagination and rate-limit policy must be implemented before high-volume historical ingestion.

## Provenance

Every market-data point carries a source identifier containing venue, endpoint family, symbol and interval.

Dataset versions hash the ordered data payload using SHA-256.

## Promotion rule

A provider adapter is not considered research-grade merely because it returns valid JSON. It must pass fixture tests, timestamp tests, duplicate tests, gap tests and documented rate-limit behavior.
