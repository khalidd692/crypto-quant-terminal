Expérience 001 — récupération NLP de signaux faibles.

Périmètre : architecture uniquement. Le module devra indexer des commits GitHub et des textes réglementaires dans SQLite/FTS5, puis exposer des recherches textuelles déterministes et rapides. Aucune aspiration de données n’est implémentée à ce stade.

Contraintes : données et schémas propres au laboratoire, séparation stricte des sources, validation Pydantic stricte, traçabilité des documents et verdicts reproductibles.