import { calibrationReport } from "../src/statistics/calibration.js";

const report = calibrationReport([
  { probability: 0.9, outcome: 1 },
  { probability: 0.8, outcome: 1 },
  { probability: 0.2, outcome: 0 },
  { probability: 0.1, outcome: 0 },
]);
if (report.brierScore < 0 || report.brierScore > 1) throw new Error("Invalid Brier score");
if (report.logLoss < 0) throw new Error("Invalid log loss");
if (report.bins.length === 0) throw new Error("Calibration bins missing");
