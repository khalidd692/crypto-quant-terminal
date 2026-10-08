# Recherche FTS

Architecture prévue pour rechercher des signaux faibles liés notamment à MTL et à la régulation.

Le moteur de recherche devra séparer :

- requêtes lexicales exactes ;
- combinaisons de termes ;
- filtres temporels ;
- filtres par type de source ;
- classement/ranking ;
- restitution d’extraits avec provenance.

La première implémentation devra être benchmarkée sur un corpus figé avant toute conclusion quantitative. Aucun seuil prédictif ni score d’edge n’est défini ici.