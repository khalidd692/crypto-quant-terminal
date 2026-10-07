import { assertChronologicalProtocol } from "../src/backtest/protocol.js";

assertChronologicalProtocol({
  split: {
    trainStart: "2020-01-01",
    trainEnd: "2022-01-01",
    validationStart: "2022-01-02",
    validationEnd: "2023-01-01",
    testStart: "2023-01-02",
    testEnd: "2024-01-01",
  },
  purgeEmbargo: {
    purgeDurationMs: 86_400_000,
    embargoDurationMs: 86_400_000,
    rationale: "Configured from maximum outcome overlap duration.",
  },
  finalHoldoutStart: "2024-01-02",
  costsVersion: "costs-v1",
  universeVersion: "universe-v1",
});
