# Schémas Pydantic stricts

Les frontières du module seront validées par des modèles Pydantic configurés en mode strict.

Schémas prévus :

- `DocumentRecord` : identité, type de source, hash, contenu et métadonnées communes.
- `GitHubCommitRecord` : repository, SHA, auteur, dates et message.
- `RegulatoryTextRecord` : juridiction, autorité, référence, dates et texte.
- `SearchQuery` : requête, filtres de source, limites et paramètres de ranking.
- `SearchHit` : document_id, score, extrait et métadonnées minimales.
- `Experiment001Manifest` : version du schéma, version SQLite/FTS, empreinte du corpus et paramètres de recherche.

Règles : types explicites, aucune coercition implicite, champs obligatoires explicitement définis, valeurs supplémentaires refusées et versions de schéma traçables.

Aucun modèle Pydantic exécutable n’est créé avant validation de l’architecture.