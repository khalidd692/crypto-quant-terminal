# Context snapshots
La couche `src/context/` est descriptive et versionnée. Elle couvre le marché crypto, la macro, le calendrier d'événements, la liquidité, les fondamentaux et un régime macro descriptif.
Chaque snapshot est `context-snapshot.v1` et porte un hash SHA-256 calculé sur une représentation canonique. Une modification du contenu invalide le hash.
Cette couche reste séparée de la probabilité, de l'expectancy, du holdout et d'ADR-0002.