# ADR-0003 (PROPOSITION) — Étude prospective et qualité des entrées TEL

- **Statut : PROPOSITION NON APPROUVÉE — aucune exécution autorisée**
- **Date de rédaction : 2026-10-09**
- **Auteur : proposition préparatoire**
- **Portée : conception d'une étude séparée de Phase 3, centrée sur la qualité d'entrée spot**
- **Invariants : ADR-0002, dataset gelé, holdout et résultats historiques Phase 3 restent intacts. Le verdict Phase 3 demeure PAS D'EDGE.**

> Ce document est un protocole proposé à examiner. Il ne lance aucun backtest, ne charge aucun dataset de recherche, ne définit pas une nouvelle stratégie en production et n'autorise pas l'utilisation du holdout de Phase 3. Aucune analyse ne commence avant approbation explicite et création d'un jeu de données distinct, versionné et haché.

## 1. Question et hypothèse falsifiable

Question : les règles d'entrée identifient-elles des entrées spot TEL dont le risque de baisse après le signal est inférieur à des règles simples, après coûts et dans plusieurs régimes de marché ?

Hypothèse nulle : le mécanisme proposé n'améliore pas la métrique principale par rapport aux bases nulles, après coûts, avec incertitude ajustée pour les observations dépendantes.

Le système reste une aide à la décision. Aucun ordre n'est envoyé et aucun résultat ne constitue une promesse de performance.

## 2. Mesure principale pré-enregistrée

**Mesure proposée : excursion adverse maximale sur les 7 jours suivant l'entrée, normalisée par l'ATR connu à l'instant de décision (MAE-ATR-7d).**

Pour chaque signal à l'instant (t) :
- (ATR_t) est calculé uniquement à partir de données disponibles à (t).
- (L_{t,t+7d}) est le plus bas observé dans les 7 jours suivant (t), selon des bougies et timestamps point-in-time.
- (MAE\text{-}ATR\text{-}7d = \max(0, (P_t-L_{t,t+7d})/ATR_t)).
- Une valeur plus faible indique une excursion adverse post-entrée plus faible. Les données manquantes et les fenêtres censurées sont déclarées, jamais imputées silencieusement.

Mesures secondaires descriptives : rendement net à 1, 3 et 7 jours, excursion favorable/adverse, drawdown, taux de coûts rapportés au mouvement brut, taux de signaux évaluables et calibration par régime. Elles ne remplacent pas la métrique principale après observation des résultats.

La définition, l'horizon, les règles d'inclusion, le calcul des coûts et les critères ci-dessous doivent être figés et hachés avant toute exécution. Toute modification après observation constitue un nouveau protocole.

## 3. Bases nulles obligatoires

Toutes les bases sont comparées sur des dates, actifs, coûts et règles d'exécution équivalents :

1. **Entrée aléatoire** : tirages reproductibles, graine publiée, uniquement parmi les instants éligibles.
2. **Achat quotidien** : achat à une heure UTC fixée à l'avance, sans sélection par signal.
3. **DCA** : calendrier et taille des tranches définis avant le test, sans ajustement rétrospectif.
4. **Pas d'achat** : aucune position ; baseline de référence pour les coûts et l'activité, sans prétendre qu'un rendement nul est comparable à une exposition positive.

Les bases aléatoires utilisent plusieurs tirages avec graines pré-enregistrées ; le nombre de tirages doit être décidé avant l'étude et non selon les résultats.

## 4. Données et prévention des fuites

- Construire un **dataset de recherche distinct** du dataset Phase 3 et de son holdout. Manifeste versionné : source, intervalle, timestamps d'observation et de disponibilité, règles de nettoyage, trous, hash SHA-256.
- Les caractéristiques à (t) ne peuvent utiliser que les informations disponibles à (t) (**point-in-time**), jamais une version révisée publiée plus tard.
- Réserver **30 % des données chronologiques comme holdout de conception** : inaccessible pendant la définition, le débogage, le choix des seuils et la comparaison des variantes. Il ne peut être ouvert qu'une seule fois après verrouillage du protocole et du code.
- Séparer chronologiquement développement et évaluation ; purge/embargo couvrant les horizons qui se chevauchent.
- Toute contamination, révision de données ou rupture de hash arrête l'étude.

Le holdout de 30 % proposé ici est nouveau et indépendant ; il ne remplace, ne lit, ne copie et ne modifie pas le holdout verrouillé de Phase 3.

## 5. Comparables et régimes

- Panier pré-déclaré d'altcoins comparables selon liquidité, ancienneté et disponibilité des données, comprenant explicitement des actifs ayant fortement baissé, échoué ou disparu. Le panier et la règle de survivance doivent être documentés avant collecte.
- TEL seul ne suffit pas à soutenir une conclusion générale : les observations d'un seul actif et d'une seule période ne constituent pas des réplications indépendantes.
- Rapports séparés pour les régimes **bull**, **bear** et **range**, avec définition mécanique des régimes connue à l'avance et fondée sur des données disponibles au moment du signal.
- Résultats agrégés et par actif/régime ; ne pas masquer un régime défavorable derrière la moyenne.

## 6. Coûts et exécution simulée

- Frais réels vérifiables par plateforme et date, spread, slippage estimé depuis les carnets archivés si disponibles, et impact de liquidité.
- Si un coût nécessaire manque, marquer l'observation non évaluable ou appliquer une borne de stress pré-enregistrée ; aucune imputation optimiste.
- Entrées/sorties et disponibilité des ordres limités doivent être simulées avec des hypothèses explicites. Un simple contact intrabougie avec un prix limite ne prouve pas le remplissage.
- Pas de levier, pas d'exécution réelle, pas de prétention à la tradabilité sur la seule base d'un backtest.

## 7. Dépendance, incertitude et multiplicité

- Utiliser un **bootstrap par blocs** pour préserver une partie de la dépendance temporelle ; taille de bloc et nombre de réplications fixés avant les résultats.
- Les fenêtres d'observation de 7 jours se chevauchent : les signaux ne sont pas indépendants. Rapporter le nombre de signaux bruts et le nombre de blocs/épisodes effectivement indépendants.
- Au plus **1 à 2 paramètres ajustables**, tous énumérés dans le protocole pré-enregistré. Pas de recherche large, optimisation répétée ou sélection post-hoc.
- Rapporter les intervalles d'incertitude et les résultats défavorables, pas seulement les estimations ponctuelles.

## 8. Critère de rejet pré-enregistré proposé

Rejeter l'hypothèse d'amélioration si l'une de ces conditions survient :
1. le MAE-ATR-7d n'est pas inférieur à la meilleure base nulle pertinente après coûts, avec intervalle de confiance par blocs ne soutenant pas l'amélioration pré-déclarée ;
2. l'amélioration agrégée est portée par un seul actif ou un seul régime et ne se reproduit pas sur les actifs/régimes pré-déclarés ;
3. la couverture des données, les coûts ou la taille effective de l'échantillon ne permettent pas d'atteindre la puissance minimale déterminée avant le test ;
4. une fuite point-in-time, une contamination du holdout, un hash incohérent ou une déviation du protocole est détectée.

La marge d'amélioration minimale, le niveau de confiance, la puissance, le nombre minimum d'événements indépendants et la taille de bloc sont **à fixer avant toute exécution** dans une version approuvée de cette ADR. Tant que ces valeurs ne sont pas définies, le protocole n'est pas exécutable.

## 9. Conditions préalables et arrêt

Avant toute étude, une approbation explicite doit figer :
- panier et données disponibles ;
- définition des régimes ;
- coûts et règles de remplissage ;
- paramètres et graines ;
- partage chronologique et holdout 30 % ;
- taille de bloc, nombre de réplications, puissance et critère numérique de rejet ;
- code, dépendances, environnement et manifeste de données.

Une exécution échouée ou défavorable est conservée. Aucun résultat ne modifie ADR-0002, ses données, son holdout ou son verdict PAS D'EDGE. Aucune étude ne démarre à partir de cette proposition seule.
