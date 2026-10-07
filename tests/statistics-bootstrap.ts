import { movingBlockBootstrapMean } from "../src/statistics/bootstrap.js";

const values = Array.from({ length: 200 }, (_, i) => 0.1 + Math.sin(i / 4) * 0.02);
const a = movingBlockBootstrapMean(values, { blockSize: 8, resamples: 300, seed: 123 });
const b = movingBlockBootstrapMean(values, { blockSize: 8, resamples: 300, seed: 123 });
if (!a || !b) throw new Error("Bootstrap unexpectedly returned null");
if (a.estimate !== b.estimate || a.lower !== b.lower || a.upper !== b.upper) throw new Error("Bootstrap is not deterministic");
if (!(a.lower <= a.estimate && a.estimate <= a.upper)) throw new Error("Bootstrap interval does not contain estimate");
