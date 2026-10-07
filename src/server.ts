import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BinancePublicClient } from "./adapters/binance/public-client.js";
import { validateMarketData } from "./domain/data.js";
import { createDatasetVersion } from "./research/dataset.js";
import { evaluateReadOnly } from "./terminal/evaluate.js";
import { loadFrozenTerminalEstimator } from "./terminal/bootstrap-model.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(payload));
}

function html(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crypto Quant Decision Terminal</title>
<style>
body{margin:0;background:#0b0d10;color:#eef2f6;font:15px system-ui,sans-serif}
main{max-width:720px;margin:auto;padding:20px}
.card{background:#151922;border:1px solid #28303b;border-radius:16px;padding:18px;margin:12px 0}
h1{font-size:22px;margin:0 0 6px} h2{font-size:15px;color:#9aa6b2}
input,button{font:inherit;border-radius:10px;padding:11px;border:1px solid #394352;background:#0f1319;color:#fff}
button{cursor:pointer}.row{display:flex;gap:8px}.row>*{flex:1}
.value{font-size:28px;font-weight:700}.muted{color:#9aa6b2}
pre{white-space:pre-wrap;overflow:auto}
</style>
</head>
<body><main>
<div class="card"><h1>Crypto Quant Decision Terminal</h1><div class="muted">Read-only • no orders • validation-first</div></div>
<div class="card"><div class="row"><input id="symbol" value="BTCUSDT"><input id="interval" value="1h"><button onclick="run()">Evaluate</button></div></div>
<div class="card"><h2>DECISION</h2><div id="decision" class="value">—</div><div id="reasons" class="muted"></div></div>
<div class="card"><h2>CONTEXT</h2><pre id="context">No evaluation yet.</pre></div>
<script>
async function run(){
  const symbol=document.getElementById('symbol').value.toUpperCase();
  const interval=document.getElementById('interval').value;
  document.getElementById('decision').textContent='Loading…';
  const response=await fetch('/api/evaluate?symbol='+encodeURIComponent(symbol)+'&interval='+encodeURIComponent(interval));
  const data=await response.json();
  if(!response.ok){document.getElementById('decision').textContent='ERROR';document.getElementById('reasons').textContent=data.error||'Request failed';return}
  document.getElementById('decision').textContent=data.decision;
  document.getElementById('reasons').textContent=(data.reasons||[]).join(' • ');
  document.getElementById('context').textContent=JSON.stringify(data,null,2);
}
</script></main></body></html>`;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") return json(response, 200, { status: "ok", mode: "read-only" });
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(html());
    return;
  }
  if (url.pathname !== "/api/evaluate") return json(response, 404, { error: "not_found" });

  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  const interval = url.searchParams.get("interval") ?? "1h";
  try {
    const client = new BinancePublicClient({ market: "usdm-futures" });
    const points = await client.klines(symbol, interval, 200);
    const validation = validateMarketData(points);
    if (!validation.valid) return json(response, 422, { error: "invalid_market_data", validation });
    const dataset = createDatasetVersion(
      points,
      [`binance:usdm-futures:${symbol}:${interval}`],
      "market-data-v1",
      new Date().toISOString(),
    );
    const estimator = await loadFrozenTerminalEstimator();
    const bookTicker = await client.bookTicker(symbol);
    const evaluation = evaluateReadOnly(symbol, points, dataset.datasetVersion, new Date().toISOString(), { bookTicker, estimator, equityQuote: 10_000, existingPortfolioRiskQuote: 0, portfolioRiskLimitQuote: 200, maxRiskFraction: 0.01, maxLeverage: 2 });
    return json(response, 200, {
      symbol,
      interval,
      datasetVersion: dataset.datasetVersion,
      regime: evaluation.regime,
      setup: evaluation.setup,
      decision: evaluation.signal.decision,
      side: evaluation.signal.side,
      reasons: evaluation.signal.vetoReasons,
      modelVersion: evaluation.signal.modelVersion,
      note: "Read-only terminal: estimator is trained only on the frozen training window; no execution is performed.",
    });
  } catch (error) {
    return json(response, 502, { error: error instanceof Error ? error.message : "provider_error" });
  }
}

createServer((request, response) => {
  void handle(request, response);
}).listen(port, () => {
  console.log(`Crypto Quant Decision Terminal listening on :${port}`);
});
