# Alertes prospectives

Le mode est **dry-run par défaut**. Aucune alerte externe n'est envoyée tant que `ALERT_DRY_RUN=false` n'est pas explicitement configuré.

Variables:
- `ALERT_DRY_RUN`: `true` par défaut; passer à `false` pour autoriser l'envoi.
- `ALERT_CHANNEL`: `telegram` ou `webhook`.
- `ALERT_MIN_INTERVAL_MS`: anti-spam global, 900000 par défaut.
- Telegram: secrets GitHub `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`.
- Webhook: secret GitHub `ALERT_WEBHOOK_URL`.

Configuration manuelle: Repository -> Settings -> Secrets and variables -> Actions. Ne jamais committer les valeurs. Pour Telegram, créer un bot via BotFather, démarrer/autoriser le bot dans le chat cible, puis stocker le token et l'identifiant du chat comme secrets.

Chaque tentative d'alerte est journalisée dans `research/prospective/journal.jsonl`; les doublons et le rate-limit sont également journalisés. Les alertes ne modifient ni les décisions historiques, ni le holdout, ni ADR-0002.
