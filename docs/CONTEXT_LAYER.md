# Context layer

The `src/context/` layer is a descriptive context contract. It does not train a model, estimate an edge, alter Phase 3 probabilities, or access the final holdout.

It records six context families:

1. crypto market conditions;
2. macro conditions;
3. event calendar;
4. liquidity;
5. asset fundamentals;
6. a descriptive macro-regime label and rationale.

Every observation carries source and availability timestamps where applicable. A complete snapshot is sealed with a SHA-256 hash by `createContextSnapshot`. Consumers must call `assertContextSnapshotHash` before trusting a persisted snapshot.

This PR intentionally provides the typed contract and hash/seal mechanism only. External providers and live polling are not silently invented: provider adapters belong to the automation/data-ingestion work and must preserve source identifiers and availability times.

The context layer is informational and remains separate from the frozen Phase 3 research result, ADR-0002, and the final holdout.
