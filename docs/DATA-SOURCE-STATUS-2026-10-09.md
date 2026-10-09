# État des sources TEL — 2026-10-09

**Date de vérification : 2026-10-09.** Cette note décrit les limites de disponibilité ; elle ne constitue pas un signal de marché.

## Spot et liquidité

- KuCoin Spot : ticker, bougies horaires et carnet utilisés comme source principale.
- MEXC Spot : ticker de contrôle et carnet séparé demandé via l'API publique de profondeur. Le statut MEXC est indépendant ; carnet absent, invalide ou slippage non calculable = `UNAVAILABLE`, donc aucune décision `ENTRER`.
- La cohérence du prix KuCoin/MEXC reste évaluée par la politique de surveillance existante. Aucun seuil de cohérence n'est modifié par cette PR.
- Les seuils de spread, slippage et profondeur réutilisent les seuils déjà présents dans la politique de liquidité ; aucun seuil nouveau n'est calibré ici.

## Vesting / déblocages TEL

La page officielle [Telcoin Association — TEL issuance/mining levels](https://www.telcoinassociation.org/documentation/telcoin-platform/telcoin-network/telcoin-network-products/telcoin-network-tel-stocks-flows-and-issuance-mining-levels) décrit des flux d'émission et de distribution du réseau, dont les paramètres peuvent être gouvernés. Elle **n'est pas** un calendrier daté complet des déblocages de tokens détenus par investisseurs, équipes ou autres détenteurs.

Conséquence : le calendrier de vesting/déblocages TEL reste explicitement **UNAVAILABLE** tant qu'une source officielle, datée, complète et vérifiable n'est pas identifiée. Aucun calendrier tiers non vérifié ne sera utilisé comme veto ou signal. Le statut UNAVAILABLE conserve le comportement conservateur existant.

## VWAP ancré

Le VWAP ancré est calculé à partir de bougies spot disponibles depuis `TEL_ANCHORED_VWAP_START_AT`, horodatage de creux majeur configuré manuellement et fourni à l'exécution. Sans ancre valide ou avec moins de deux bougies valides, le résultat est **UNAVAILABLE**. Cette mesure est affichée comme information descriptive, pas comme déclencheur de décision. Le prix moyen personnel reste uniquement dans le rapport privé de position ; il n'est pas ajouté à l'écran public ni au journal public.

## Funding / open interest TEL sur MEXC

Aucun funding/OI n'est considéré fiable pour TEL tant que l'existence d'un contrat perpétuel TEL/USDT actif sur MEXC et la fraîcheur/sémantique des champs ne sont pas vérifiées à l'exécution. Ces données restent **UNAVAILABLE / non utilisées** et ne sont jamais remplacées par le funding/OI BTC, un autre exchange ou un agrégateur tiers. Si un contrat fiable est confirmé plus tard, ses mesures seront secondaires, clairement séparées du spot, et ne pourront jamais promouvoir une décision bloquée.

## Exclusions

- Aucun indicateur « baleines » tiers.
- Aucun on-chain générique utilisé comme déclencheur d'entrée.
- Aucune modification des seuils P0, de l'ADR-0002, du dataset gelé, du holdout ou des résultats historiques.
