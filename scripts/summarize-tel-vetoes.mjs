import { readFileSync, existsSync } from "node:fs";
import { readProspectiveJournal } from "../dist/src/automation/journal.js";

const path = process.env.PROSPECTIVE_JOURNAL ?? "research/prospective/journal.jsonl";
const now = Date.now();
const windowMs = 7 * 24 * 60 * 60 * 1000;
const records = existsSync(path)
  ? readProspectiveJournal(path).filter((r) => Date.parse(r.recordedAt) >= now - windowMs && Date.parse(r.recordedAt) <= now + 5 * 60_000 && r.mode === "TEST_SANS_ARGENT" && r.angles)
  : [];
const angles = new Map();
const vetoes = new Map();
for (const record of records) {
  for (const item of record.angles ?? []) {
    const current = angles.get(item.angle) ?? { evaluated: 0, available: 0, unavailable: 0, veto: 0 };
    current.evaluated++;
    if (item.status === "OK" || item.status === "BLOC") current.available++;
    if (item.status === "UNAVAILABLE" || item.status === "PÉRIMÉ" || item.status === "INCOHÉRENT") current.unavailable++;
    if (item.status === "BLOC" || item.status === "PÉRIMÉ" || item.status === "INCOHÉRENT") {
      current.veto++;
      const key = `${item.angle} — ${item.status}: ${item.detail}`;
      vetoes.set(key, (vetoes.get(key) ?? 0) + 1);
    }
    angles.set(item.angle, current);
  }
}
console.log("## Résumé disponibilité / veto TEL — 7 derniers jours");
console.log(`Fenêtre : ${new Date(now - windowMs).toISOString()} → ${new Date(now).toISOString()}`);
console.log(`Runs prospectifs avec diagnostics structurés : ${records.length}`);
console.log("");
console.log("| Angle | Évaluations | Disponible (OK/BLOC) | UNAVAILABLE/périmé/incohérent | Veto |");
console.log("|---|---:|---:|---:|---:|");
for (const [name, value] of [...angles].sort(([a], [b]) => a.localeCompare(b))) {
  const pct = value.evaluated ? (100 * value.available / value.evaluated).toFixed(1) + "%" : "n/a";
  console.log(`|${name}|${value.evaluated}|${pct} (${value.available})|${value.unavailable}|${value.veto}|`);
}
console.log("");
console.log("### Fréquence des vetos");
if (!vetoes.size) console.log("Aucun veto BLOC/PÉRIMÉ/INCOHÉRENT enregistré sur cette fenêtre.");
else {
  console.log("| Veto | Occurrences |");
  console.log("|---|---:|");
  for (const [reason, count] of [...vetoes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`|${reason.replaceAll("|", "\\|")}|${count}|`);
  }
}
console.log("");
console.log("Les données historiques sans diagnostics structurés sont exclues du dénominateur; aucun seuil n'est modifié.");
