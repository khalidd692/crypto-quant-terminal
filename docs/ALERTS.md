# Alertes TEL — configuration manuelle

Le moteur est **dry-run par défaut** (`ALERT_DRY_RUN=true`). Il n'exécute aucun ordre.

## Canal webhook
Configurer dans GitHub Actions/Repository Secrets :
- `ALERT_WEBHOOK_URL`
- `ALERT_CHANNEL=webhook`
- `ALERT_DRY_RUN=false` uniquement après validation manuelle du canal.

## Canal Telegram
Créer un bot via BotFather, récupérer le token et l'identifiant du chat, puis configurer uniquement comme secrets GitHub :
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ALERT_CHANNEL=telegram`
- `ALERT_DRY_RUN=false`

Optionnel : `ALERT_MIN_INTERVAL_MS` — intervalle anti-spam ; défaut 900000 ms.
`X_BEARER_TOKEN` est séparé et ne concerne que le fournisseur social optionnel.

Chaque alerte est appendue au journal prospectif avec une clé de déduplication et un hash de snapshot. Les alertes d'état, macro majeures et proximité des niveaux stop/invalidation/targets utilisent le même mécanisme anti-doublon/anti-spam.
