import { loadResearchPoints, assertResearchTimestamp, RESEARCH_END_EXCLUSIVE } from "../src/research/research-dataset-loader.js";
import type { MarketDataPoint, ISO8601 } from "../src/domain/types.js";

const point=(time:string):MarketDataPoint=>({
  instrumentId:"TEST",eventTime:time as ISO8601,availableTime:time as ISO8601,
  open:1,high:2,low:1,close:1.5,volume:10,dataQuality:"complete",sourceId:"fixture"
});

assertResearchTimestamp("2025-12-31T23:59:59.999Z");
if (RESEARCH_END_EXCLUSIVE !== "2026-01-01T00:00:00.000Z") throw new Error("research cutoff changed");
let rejected=false;
try { assertResearchTimestamp("2026-01-01T00:00:00.000Z"); } catch { rejected=true; }
if (!rejected) throw new Error("holdout boundary must be rejected");
if (loadResearchPoints([point("2025-01-01T00:00:00.000Z")]).length !== 1) throw new Error("valid research point was rejected");
rejected=false;
try { loadResearchPoints([point("2026-01-01T00:00:00.000Z")]); } catch { rejected=true; }
if (!rejected) throw new Error("research loader accepted holdout timestamp");
console.log("research-dataset-loader: ok");
