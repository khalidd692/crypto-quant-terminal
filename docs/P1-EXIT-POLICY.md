# P1 — politique de sortie SPOT TEL

**Version : p1-exit-plan.v1 — 2026-10-08**

Valeurs par défaut écrites avant toute analyse prospective :

- 2 paliers de prise de bénéfice : 50 % à `target1`, 50 % à `target2`.
- Stop initial : invalidation fixée avant l'entrée ; distance minimale ≥ 1.5 ATR.
- Stop suiveur : 1.5 ATR sous le plus-haut observé depuis l'entrée.
- Sortie temporelle : 7 jours par défaut si aucun target/invalidation n'est atteint.
- `CORE_HOLD` est toujours intouchable par le moteur de sortie.
- Les états `SORTIR`, `ALLÉGER`, `TENIR` sont descriptifs ; aucune prédiction n'est produite.
- Toutes les statistiques portent le libellé **« statistique historique, pas une prévision »**.
