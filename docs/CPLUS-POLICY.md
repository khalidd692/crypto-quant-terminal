# C+ — règles macro/fondamentales gelées avant analyse

**Version : cplus-context.v1 — 2026-10-08**

Sources prioritaires sans clé : FRED (dollar large, S&P 500, taux US, or, M2), stablecoins/crypto providers existants, et sources publiques officielles Telcoin. Les champs sans source publique robuste sont `UNAVAILABLE`.

## Règles descriptives
- Régime favorable au risque : taux en détente ET dollar large en baisse ; neutre si les signaux sont mixtes ; défavorable si taux en hausse ET dollar en hausse ; sinon `UNKNOWN`.
- Calendrier : une annonce macro majeure à l'intérieur de la fenêtre configurée doit pouvoir dégrader une entrée en `ATTENDRE`.
- Corrélations TEL : fenêtres 30/90/180 jours ; intervalle Fisher 95 % ; rupture indicative si la variation absolue de corrélation entre deux fenêtres successives atteint 0,50 ; inversion si le signe change. Libellé obligatoire : **« corrélation descriptive, pas causale, instable »**.
- Fondamentaux TEL : actualités et supply peuvent être renseignées depuis les sources publiques ; token unlocks, activité réseau et flux notables restent `UNAVAILABLE` tant qu'une source point-in-time vérifiable n'est pas branchée.
- Aucun signal macro/fondamental ne peut créer une entrée ; un signal défavorable ou `UNAVAILABLE` peut uniquement dégrader `ENTRER` en `ATTENDRE`.

Les règles ne sont pas calibrées sur le dataset historique gelé.
