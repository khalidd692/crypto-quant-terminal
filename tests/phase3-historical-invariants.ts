const HISTORICAL = {
  validation: {
    totalObservations: 8759,
    cleanEligibleObservations: 3790,
    ambiguousObservations: 52,
    targetHits: 1041,
    invalidationHits: 1791,
    meanR: -0.27387454648158277,
  },
  test: {
    totalObservations: 17536,
    cleanEligibleObservations: 8964,
    ambiguousObservations: 100,
    targetHits: 2766,
    invalidationHits: 4275,
    meanR: -0.20397163645157348,
  },
} as const;

for (const [partition, value] of Object.entries(HISTORICAL)) {
  const otherExclusions = value.totalObservations - value.cleanEligibleObservations - value.ambiguousObservations;
  if (otherExclusions < 0) throw new Error(`${partition}: invalid historical exclusion arithmetic`);
  console.log(JSON.stringify({
    partition,
    totalObservations: value.totalObservations,
    cleanEligibleObservations: value.cleanEligibleObservations,
    ambiguousObservations: value.ambiguousObservations,
    otherExclusions,
    targetHits: value.targetHits,
    invalidationHits: value.invalidationHits,
    meanR: value.meanR,
  }));
}

console.log("phase3-historical-invariants: ok");
