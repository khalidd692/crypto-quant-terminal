import type { EntryQuality, SpotRiskResult, SwingDecision } from "./tel-swing.js";
export interface TelTestScreenInput { readonly decision:SwingDecision; readonly quality:EntryQuality; readonly btcStatus:"OK"|"BLOCKED"|"UNAVAILABLE"; readonly macroStatus:"OK"|"UNAVAILABLE"; readonly sentimentStatus:"OK"|"UNAVAILABLE"; readonly risk:SpotRiskResult; readonly riskMaxPct:number; readonly reason:string; }
export function renderTelTestScreen(input:TelTestScreenInput):string{
  const checks=[
    ["Prix étiré ?",input.quality.decision==="ACCEPTABLE"?"OK":"BLOC"],
    ["BTC ?",input.btcStatus==="OK"?"OK":"BLOC"],
    ["Macro / calendrier ?",input.macroStatus==="OK"?"OK":"BLOC"],
    ["Sentiment ?",input.sentimentStatus==="OK"?"OK":"BLOC"],
    ["Taille + stop ?",input.risk.allowed?"OK":"BLOC"]
  ];
  const rows=checks.map(([label,status])=>`<li><b>${status}</b> ${label}</li>`).join("");
  const riskPct=(input.risk.riskBudgetQuote>0?input.risk.riskBudgetQuote:"0").toString();
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Puis-je acheter maintenant ?</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#eef2f6;font:16px system-ui,sans-serif}main{max-width:520px;margin:auto;padding:14px}.card{background:#151922;border:1px solid #28303b;border-radius:16px;padding:16px;margin:10px 0}.state{font-size:38px;font-weight:900}.test{font-weight:800}.muted{color:#9aa6b2}.checks{list-style:none;padding:0}.checks li{padding:10px 0;border-bottom:1px solid #28303b}.risk{font-size:18px}</style></head><body><main><div class="card"><h1>Puis-je acheter maintenant ?</h1><div class="test">EN TEST — SANS ARGENT</div><div class="muted">SPOT · poche SWING uniquement</div></div><div class="card"><div class="state">${input.decision}</div><div>${input.reason}</div><div class="muted">Entrée redevient acceptable sous/à: ${input.quality.acceptableMaxEntry??"UNAVAILABLE"}</div></div><div class="card"><h2>5 vérifications</h2><ul class="checks">${rows}</ul></div><div class="card risk"><b>Risque max</b><br>${riskPct} quote · ${(input.risk.riskBudgetQuote>0?input.risk.riskBudgetQuote/input.riskBudgetQuote*100:0).toFixed(1)} % du budget de risque</div><div class="card muted">Les statistiques sont historiques et descriptives, pas une prévision. Aucun ordre n'est exécuté.</div></main></body></html>`;
}