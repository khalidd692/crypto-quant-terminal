# TEL SPOT — valeurs opérationnelles de sortie (version 1)

- **Date de fixation : 2026-10-09**
- **Statut : défauts opérationnels proposés, non validés par une étude de performance**
- **Aucune optimisation ni recherche n'a été exécutée pour choisir ces valeurs.**
- **Invariants : dataset gelé, holdout, ADR-0002, résultats historiques et verdict PAS D'EDGE inchangés.**

| Paramètre | Valeur par défaut | Fonction |
|---|---:|---|
| Stop catastrophe | entrée − 2,5 × ATR à l'entrée | Niveau fixe déclaré avant l'entrée ; ne doit jamais être élargi après entrée |
| Palier 1 | entrée + 2,0 × ATR à l'entrée | Réduction de 50 % de la quantité SWING initiale |
| Palier 2 | entrée + 3,0 × ATR à l'entrée | Sortie du reliquat SWING |
| Réduction temporelle | après 5 jours complets sans palier 1 | Réduction supplémentaire de 25 % du reliquat au moment de l'évaluation |
| Stop suiveur | plus haut depuis l'entrée − 1,5 × ATR courant | Applicable uniquement au reliquat après palier 1 |
| Sens des changements de stop | hausse seulement | Le nouveau stop proposé est le maximum entre l'ancien stop et le candidat ATR |

## Interprétation et limites

Ces valeurs sont des garde-fous de départ, **pas des paramètres démontrés rentables**. Elles sont figées avant toute analyse et ne peuvent pas être optimisées sur les résultats prospectifs. L'ATR utilisé pour le stop catastrophe et les paliers est celui enregistré au moment de l'entrée (point-in-time) ; l'ATR courant n'est utilisé que pour le stop suiveur sur le reliquat.

Le moteur ne transmet aucun ordre à un exchange. Les paliers, réductions et stops sont des propositions affichées. La protection n'est réelle que si l'utilisateur place et maintient lui-même les ordres sur sa plateforme. Un stop catastrophe n'est pas garanti en cas de gap, de carnet illiquide ou d'indisponibilité de l'exchange.

Le journal de changements de stop doit conserver l'heure, l'ancien niveau, le nouveau niveau, le motif et le hash de l'état de marché, sans stocker le prix moyen, la quantité ou tout autre détail privé de position dans le dépôt public.

La position CORE_HOLD reste hors de portée de cette logique SWING. Une sortie temporelle ne doit jamais élargir un stop ni transformer une position CORE_HOLD en position SWING.
