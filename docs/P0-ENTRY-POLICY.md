# P0 — politique de qualité d'entrée SPOT TEL

**Version : p0-entry-quality.v1 — 2026-10-08**

Ces seuils sont des **garde-fous descriptifs**, écrits avant toute analyse prospective. Ils ne sont pas calibrés pour maximiser un backtest et ne constituent pas une prévision.

| Garde-fou | Défaut |
|---|---:|
| Distance max au EMA200 | 5 % |
| Distance max au VWAP roulant 24 bougies | 3 % |
| RSI maximum d'entrée | 70 |
| Hausse max 24 h | 8 % |
| Hausse max 7 j | 15 % |
| Volume relatif maximum | 3.0x médiane 20 périodes |
| Distance max au dernier plus-bas | 25 % |
| Multiplicateur ATR minimum pour le stop | 1.5 ATR |
| Risque max / trade SWING | 0.5 % du capital SWING |
| Nombre max de positions SWING | 2 |
| Perte mensuelle maximale | 2 % du capital SWING |
| Frais estimés aller-retour | 0.30 % |
| Slippage estimé | 0.50 % |
| Entrées fractionnées | 3 tranches (40/30/30) |
| BTC chute rapide | -5 % / 24 h |
| BTC rupture support | support confirmé fourni par le contexte ; UNAVAILABLE => blocage |

**Règles fail-closed :**
- donnée obligatoire manquante, périmée ou incohérente → `NE_PAS_ENTRER` ;
- le seuil d'acceptation est calculé mécaniquement à partir des garde-fous ci-dessus ;
- aucune vente ne peut viser `CORE_HOLD` ;
- spot uniquement : aucune marge, aucun levier, aucune liquidation ;
- toutes les statistiques sont libellées **« statistique historique, pas une prévision »**.

Toute modification ultérieure de ces seuils doit être tracée dans le journal prospectif et ne peut pas être rétro-ajustée pour améliorer un résultat historique.
