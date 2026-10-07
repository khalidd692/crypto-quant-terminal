import { evaluateOOSCalibration } from "../src/statistics/oos-calibration.js";

const observations = [
  { eventTime: "2026-01-01T00:00:00.000Z", probability: 0.8, outcome: 1 as const },
  { eventTime: "2026-01-02T00:00:00.000Z", probability: 0.2, outcome: 0 as const },
  { eventTime: "2026-01-03T00:00:00.000Z", probability: 0.7, outcome: 0 as const },
];

const report = evaluateOOSCalibration(observations, "2026-01-02T00:00:00.000Z");
if (report.evaluationObservations !== 2) throw new Error("OOS boundary mismatch");
if (report.estimatorVersion !== "oos-calibration.v1") throw new Error("Wrong calibration version");
