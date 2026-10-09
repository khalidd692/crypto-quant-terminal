export interface PrivateTelPositionInput {
  readonly asOf: string;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly currentPrice: number;
  readonly invalidationPrice: number;
  readonly target1: number;
  readonly target2: number;
  readonly roundTripFeePct: number;
  readonly slippagePct: number;
}

function money(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function netPnl(input: PrivateTelPositionInput, exitPrice: number): number {
  const gross = input.quantity * (exitPrice - input.averageEntryPrice);
  const estimatedFriction = input.quantity * input.averageEntryPrice *
    (input.roundTripFeePct + input.slippagePct);
  return gross - estimatedFriction;
}

export function renderPrivateTelPositionReport(input: PrivateTelPositionInput): string {
  const currentPnl = netPnl(input, input.currentPrice);
  const rows = [
    ["Cours actuel", input.currentPrice, currentPnl],
    ["Invalidation configurée", input.invalidationPrice, netPnl(input, input.invalidationPrice)],
    ["Objectif 1 configuré", input.target1, netPnl(input, input.target1)],
    ["Objectif 2 configuré", input.target2, netPnl(input, input.target2)]
  ].map(([label, price, pnl]) =>
    `<tr><td>${label}</td><td>${money(Number(price))}</td><td>${money(Number(pnl))} quote</td></tr>`
  ).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Position TEL — privé</title><style>body{font:16px system-ui,sans-serif;max-width:760px;margin:auto;padding:16px;color:#17202a}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.warning{padding:12px;background:#fff3cd;border-radius:8px}</style></head><body><h1>Position TEL — rapport privé</h1><p>Calcul local, sans ordre envoyé. Données observées : ${input.asOf} (UTC).</p><p>Prix moyen : <b>${money(input.averageEntryPrice)}</b> quote · Quantité : <b>${money(input.quantity)}</b> TEL</p><p>Valeur au cours actuel : <b>${money(input.quantity * input.currentPrice)}</b> quote</p><p>P&amp;L net estimé : <b>${money(currentPnl)}</b> quote</p><table><thead><tr><th>Scénario</th><th>Prix TEL</th><th>P&amp;L net estimé</th></tr></thead><tbody>${rows}</tbody></table><p class="warning">Les niveaux d'invalidation et objectifs sont ceux de la configuration actuelle, pas des recommandations personnalisées. Vérifie-les avant toute décision. Les frais et le slippage sont des estimations P0, pas les frais exacts de ton compte.</p></body></html>`;
}
