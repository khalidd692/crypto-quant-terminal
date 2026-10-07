import { BinancePublicClient } from "./adapters/binance/public-client.js";
import { validateMarketData } from "./domain/data.js";
import { evaluateReadOnly } from "./terminal/evaluate.js";
import { createDatasetVersion } from "./research/dataset.js";

const symbol = (process.argv[2] ?? "BTCUSDT").toUpperCase();
const interval = process.argv[3] ?? "1h";

const client = new BinancePublicClient({ market: "usdm-futures" });
const points = await client.klines(symbol, interval, 200);
const validation = validateMarketData(points);
if (!validation.valid) {
  console.error(JSON.stringify(validation, null, 2));
  process.exitCode = 1;
} else {
  const dataset = createDatasetVersion(points, [`binance:usdm-futures:${symbol}:${interval}`], "market-data-v1", new Date().toISOString());
  const evaluation = evaluateReadOnly(symbol, points, dataset.datasetVersion, new Date().toISOString());
  console.log(JSON.stringify({
    symbol,
    interval,
    datasetVersion: dataset.datasetVersion,
    regime: evaluation.regime,
    setup: evaluation.setup,
    decision: evaluation.signal.decision,
    reasons: evaluation.signal.vetoReasons,
    note: "No empirical probability model is installed; directional decisions remain blocked by INSUFFICIENT_EVIDENCE.",
  }, null, 2));
}
