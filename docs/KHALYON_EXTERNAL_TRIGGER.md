# KHALYON external refresh trigger (Phase 2)

## Why
The observed Pages workflow starts have had gaps of multiple hours despite a 15-minute cron. GitHub does not expose the intended scheduled tick for each run, so this is evidence of cadence gaps, not proof of why every slot was missed.

## Workflow contract
The Pages workflow accepts `repository_dispatch` with event type `khalyon_refresh`. This only asks GitHub Actions to run the existing build/deploy workflow; it does not place exchange orders or change research results.

## Owner-operated setup (no token in chat)
1. In GitHub, open **Settings → Developer settings → Fine-grained personal access tokens**.
2. Create a token scoped to **only** `khalidd692/crypto-quant-terminal`.
3. Grant only the repository permission required by GitHub's repository-dispatch API: **Contents: read and write**. Do not grant Actions administration, secrets, pull requests, or organization access.
4. In the repository, open **Settings → Secrets and variables → Actions → New repository secret**.
5. Name it `KHALYON_DISPATCH_TOKEN` and paste the token there. Never paste it into an issue, PR, commit, or ChatGPT.
6. From a trusted external scheduler, send a POST to `https://api.github.com/repos/khalidd692/crypto-quant-terminal/dispatches` with headers `Accept: application/vnd.github+json`, `Authorization: Bearer $KHALYON_DISPATCH_TOKEN`, `X-GitHub-Api-Version: 2022-11-28`, and JSON body `{"event_type":"khalyon_refresh"}`.
7. Schedule the external call every 15 minutes, monitor HTTP status and the resulting Actions run, and alert on consecutive failures. Do not store the token in the scheduler's logs or URL.
8. Revoke the token immediately if exposed; rotate the GitHub secret after creating a replacement.

## Safety
The external scheduler is not configured by this PR. The repository owner must provision the token and scheduler. The existing scheduled trigger remains as fallback. Workflow concurrency remains non-cancelling, and the existing fail-closed runtime freshness rule remains unchanged.
