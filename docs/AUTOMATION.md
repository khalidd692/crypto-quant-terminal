# Prospective automation
Le workflow `prospective-surveillance.yml` s'exécute toutes les 15 minutes et peut aussi être lancé manuellement. Il surveille les actifs définis dans `config/surveillance-assets.json`, utilise KuCoin comme source primaire et MEXC comme contrôle pour les actifs configurés.
Chaque observation est ajoutée à `research/prospective/journal.jsonl` sans réécriture des lignes précédentes. Chaque ligne porte un hash et le hash de la ligne précédente, ce qui rend toute altération détectable.
Les observations sont prospectives : elles enregistrent décision, raisons et hash du snapshot de contexte au moment t ; elles ne modifient aucun résultat historique et n'exécutent aucun ordre.
Les décisions sensibles sont signalées dans les logs GitHub Actions. Un webhook d'alerte peut être ajouté ultérieurement sans être nécessaire au fonctionnement de base.

## Mode test sans argent
Chaque observation de décision peut porter le prix observé et le mode `TEST_SANS_ARGENT`. Aucun ordre n'est exécuté. À échéance 1, 3 et 7 jours, le runner peut ajouter une ligne de suivi référencée par le hash du signal initial ; le rendement observé est descriptif et porte le libellé « statistique historique, pas une prévision ». Le journal reste append-only et hash-chainé.

## Bilan prospectif
Le bilan doit compter séparément les observations par horizon, conserver le nombre d'observations et afficher l'incertitude ; aucune conclusion de fiabilité n'est autorisée avant la période prospective minimale documentée.
