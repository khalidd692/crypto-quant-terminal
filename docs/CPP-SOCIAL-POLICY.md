# C++ — politique de sentiment social

**Version : cpp-social.v1 — 2026-10-08**

- Sources autorisées : Reddit public, Fear & Greed déjà branché ; X uniquement si le secret `X_BEARER_TOKEN` est configuré ; aucune récupération par scraping non autorisé.
- Température `HOT` : doublement ou plus du volume de mentions dans la fenêtre d'observation disponible **et** ton moyen ≥ 0,25.
- Concentration : part des 5 auteurs les plus actifs affichée à titre descriptif ; elle ne déclenche jamais une entrée.
- Une donnée sociale `UNAVAILABLE` ne peut que dégrader `ENTRER` en `ATTENDRE`.
- `HOT` ne peut que dégrader `ENTRER` en `ATTENDRE` ; il ne déclenche jamais une entrée.
- Libellé obligatoire : **« indice de température, bruité et manipulable, pas une prévision »**.
