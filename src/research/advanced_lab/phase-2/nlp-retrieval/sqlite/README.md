# Architecture SQLite / FTS5

SQLite est le store local de l’Expérience 001. FTS5 constitue l’index de recherche textuelle ; il ne constitue pas une source de vérité indépendante.

## Modèle logique proposé

- `documents` : identité canonique, type de source, source_id, titre, texte, date de publication/commit, URL, hash du contenu, timestamps d’ingestion.
- `github_commits` : métadonnées spécifiques aux commits (repository, SHA, auteur, date, message) reliées à `documents`.
- `regulatory_texts` : métadonnées spécifiques aux textes réglementaires (juridiction, autorité, référence, date) reliées à `documents`.
- `documents_fts` : index FTS5 sur les champs textuels retenus pour la recherche.
- `schema_metadata` : version du schéma et version de l’index pour garantir la reproductibilité.

## Principes

1. La table `documents` reste la source de vérité.
2. FTS5 est reconstruit/revalidé à partir des documents canoniques ; aucune donnée métier n’est déduite de l’index seul.
3. Les documents sont identifiés par hash pour éviter les doublons silencieux.
4. Les sources GitHub et réglementaires restent distinguables à chaque étape.
5. Les requêtes devront retourner des identifiants et métadonnées permettant de remonter au document original.
6. Aucun connecteur réseau, scraping ou aspiration n’est implémenté dans ce scaffolding.

## Performance cible

L’architecture vise un moteur local à faible latence : index FTS5 compact, requêtes ciblées, lecture des documents par identifiant et absence de dépendance à un service distant pendant la recherche.

Les choix de tokenizer, de ranking et d’index auxiliaires seront décidés avant l’implémentation.