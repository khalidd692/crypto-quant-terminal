import { calculateBinaryExpectancy, calculateNetExpectancy } from "../src/statistics/expectancy.js";

const binary = calculateBinaryExpectancy(60, 100, 1.5, 1, 0.1);
if (binary.breakEvenProbability <= 0 || binary.breakEvenProbability >= 1) throw new Error("Invalid break-even probability");
if (binary.conservativeExpectedValueR > binary.expectedValueR) throw new Error("Conservative EV cannot exceed point EV");

const net = calculateNetExpectancy(
  [
    { event: "win", probability: 0.6, payoffR: 1.5 },
    { event: "loss", probability: 0.4, payoffR: -1 },
  ],
  0.05,
  0.05,
  0,
);
if (Math.abs(net.netR - 0.4) > 1e-12) throw new Error("Net expectancy mismatch");
