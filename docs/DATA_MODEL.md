# Data Model V1.2

## Core entities

- Asset
- Instrument
- Venue
- MarketData
- FeatureDefinition
- FeatureSnapshot
- Regime
- Signal
- Outcome
- RiskSnapshot
- PortfolioSnapshot
- Experiment
- DatasetVersion
- ModelVersion

## Conceptual execution entities

Order, Fill, Position and Trade are reserved for later simulation/execution layers.

## Identity rules

Asset ≠ Instrument ≠ Venue.

A single asset may have multiple instruments. An instrument may trade on multiple venues. Venue-specific observations must never be merged without an explicit aggregation rule.

## Timestamp rules

All market observations and derived snapshots carry point-in-time timestamps. Where source latency matters, record source availability time separately from event time.

## Signal

A signal records the decision context at T0, including:

- asset/instrument/venue
- decision timestamp
- decision
- regime
- setup
- feature versions
- probability estimate
- uncertainty
- expectancy
- invalidation
- risk snapshot
- liquidity assessment
- veto reasons
- model/version identifiers

## Outcome

Outcome records what subsequently happened under a declared evaluation protocol:

- horizon
- realized return
- MFE
- MAE
- target/stop/invalidation events
- fees
- slippage
- funding
- ambiguity flags

Non-signals must also be logged when needed for unbiased evaluation.

## Versioning

DatasetVersion, FeatureDefinition version and ModelVersion are immutable identifiers referenced by downstream records.
