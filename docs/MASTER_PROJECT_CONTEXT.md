# MASTER PROJECT CONTEXT — Crypto Quant Decision Terminal

> **Purpose:** single entry point for ChatGPT, Codex, Claude and future contributors. Read this file before starting work, then inspect the linked source documents and Git history. This is a curated handoff, not a claim that every historical chat message has been recovered. When this file conflicts with source code, ADRs, immutable artifacts or Git evidence, do not silently choose: report the conflict and preserve protected artifacts.

**Repository:** `khalidd692/crypto-quant-terminal`  
**Default branch reported by GitHub:** `main`  
**Project type:** read-only quantitative decision-support terminal; not a live-trading bot.  
**Last handoff update:** 2026-10-09.

---

## 1. Start here: operating instructions

1. Read this document and the project documentation linked in §3 before acting.
2. Verify the actual repository, branch, HEAD SHA, remote, working tree and CI status. Do not rely solely on prior reports.
3. Treat GitHub as the source of truth for committed code. Local uncommitted changes are a separate state and must be reported separately.
4. Never claim a task is complete without direct evidence (diff, test output, CI result, artifact/hash or relevant commit).
5. Prefer the smallest reversible change. Inspect before editing; test after editing; report exact files and commands.
6. Do not commit, push, merge, reset, clean, rebase, delete or overwrite unless the mission explicitly authorizes it.
7. Do not make strategy or methodology changes just because a code task appears to invite them.
8. When information is unknown, label it unknown and investigate. Never invent historical decisions or results.
9. Preserve a durable audit trail in GitHub: mission, scope, changes, test evidence, CI evidence, limitations and next step.
10. If this file is stale, propose an update with evidence; do not rewrite history or erase contradictions.

## 2. User goal and product intent

The user is a TEL holder and SPOT swing trader, without leverage. The primary practical problem is **poor entry timing / buying too late**, especially after a move has already run. The aim is to build a disciplined, evidence-based decision-support tool that helps assess whether an entry is justified and when waiting is preferable.

The system must be honest about uncertainty. It must be allowed to say `WAIT`, `NO_TRADE` or `INSUFFICIENT_EVIDENCE`. No forced trade, arbitrary confidence score, hindsight optimization or unsupported claim of predictive edge.

The user wants an AI-assisted workflow in which agents do the technical execution and testing, while the human mainly supervises important decisions. ChatGPT is used for architecture, prioritization, risk analysis and review; Codex can work in the local development environment; Claude may act as Lead Tech / Reviewer where explicitly arranged. These contexts do **not** automatically share all chat history. This file and the linked evidence are the durable project memory.

## 3. Documentation map — read relevant sources before acting

Repository README and current docs list include:

- `README.md` — scope, architecture, implementation status and Phase 3 summary.
- `docs/TECHNICAL_CONTRACT_V1.2.md` — normative system contract.
- `docs/DATA_MODEL.md` — data model.
- `docs/VALIDATION_PROTOCOL.md` — validation requirements.
- `docs/RESEARCH_PROTOCOL.md` — baseline and research procedure.
- `docs/RED_TEAM_RULES.md` — adversarial review and stop-the-line conditions.
- `docs/DECISIONS.md` — architecture decisions (ADR-001 through ADR-008 as listed there; distinguish these from the separate Phase 3 ADR-0002).
- `docs/MONITOR_INDICATORS.md` — descriptive surveillance indicators.
- `docs/DATA_PROVIDER.md` — data-provider contract.
- `docs/phase3-closure-report.md` — Phase 3 verdict, diagnostics, reservations and addenda.
- `docs/funding-archive.md` — versioned replay funding archive.
- Find the actual Phase 3 `ADR-0002` file and original historical artifacts by repository search; do not assume its path from its name.

If a listed file is absent, report that and search Git history / tree / PRs before creating a replacement. There was no root `AGENTS.md` at the time this handoff was prepared; re-check before adding one.

## 4. System architecture and product boundaries

The documented pipeline is:

`DATA → REGIME → FEATURES → SETUP → PROBABILITY → EXPECTANCY → RISK → LIQUIDITY → VETO → DECISION`

Implemented foundation described by README (verify current tree before making claims about present state):

- Explicit Asset / Instrument / Venue domain model.
- Point-in-time market-data representation and validation.
- Immutable SHA-256 dataset versioning.
- Read-only public market data adapter.
- Open-candle exclusion and configurable availability lag.
- Trend, momentum, volatility, volume and candle-structure feature families.
- Transparent baseline setup.
- Empirical probability estimation with Wilson uncertainty intervals.
- Brier score / log loss calibration metrics.
- Cost-aware expectancy and break-even probability.
- Invalidation-based sizing with leverage and liquidity caps.
- Liquidity hard gate, portfolio risk gate and separate hard-veto engine.
- Multi-timeframe alignment contract.
- Cost-aware outcome simulation with explicit intrabar ambiguity.
- Chronological backtest protocol with purge/embargo fields.
- Experiment registry, CLI, minimal mobile web API/UI and GitHub Actions build/test pipeline.

The product is intentionally read-only / simulation-only. Live order execution, exchange credentials, automatic capital deployment and black-box AI-generated probabilities are out of scope until the research gate is satisfied. Do not add live trading.

Decision vocabulary in the technical contract: `LONG`, `SHORT`, `WAIT`, `NO_TRADE`, `INSUFFICIENT_EVIDENCE`. Liquidity is a hard gate, not merely a score. Invalidation is distinct from an execution stop. Probabilities require empirical grounding and uncertainty must be reported separately.

## 5. Scientific status: Phase 3 is closed as PAS D'EDGE

The Phase 3 closure report states **PAS D'EDGE**: no demonstrated statistical edge. This is the governing conclusion unless a future, explicitly authorized and methodologically valid process changes it. Do not reframe diagnostics as evidence of an edge.

### Immutable/protected items

- Phase 3 ADR-0002.
- Frozen dataset, full SHA-256:
  `6684d0e7bfb27080430164729e6aa8ac556ac09a728f373eeb32ef3b4781abce`
- Untouched final holdout: must remain virgin. Do not access it, consume it, use it for iteration, tune against it, or alter its contents.
- Historical research run and historical results: preserve exactly; no retrospective rewrites.
- No ADR-0003.
- No new strategy hypothesis, parameter optimization or new research run without explicit authorization.
- Diagnostics or reporting changes must not alter historical calculations/results.

The closure report identifies PR #46 head SHA `8991d67009164fbf9efb3ca09f06d75e4c1a0507` and merge commit `097443523c7328e155caa8327a880f20daea9319`. Verify these against GitHub before relying on them.

### Historical Phase 3 findings and methodological debt

The closure report records:
- Validation strategy mean R: `-0.2738745465`.
- Test strategy mean R: `-0.2039716365`.
- Validation diagnostics: RANDOM_ENTRY `-0.2359`, ALWAYS_LONG `-0.2238`.
- Test diagnostics: RANDOM_ENTRY approximately `-0.204`, ALWAYS_LONG `-0.2229`.
- RANDOM_ENTRY and ALWAYS_LONG are diagnostics outside the ADR-0002 contractual edge criteria.
- Buy-and-Hold is a partition-level return and is not directly comparable to mean R per trade.
- Six methodological reservations are documented: inconsistent cost-sign convention / break-even inconsistency; inverted cost sensitivity; TIME_EXIT population differs between criterion 1 and global mean R; Buy-and-Hold unit incompatibility; RANDOM_ENTRY / ALWAYS_LONG are non-contractual diagnostics; simulator calibration does not reproduce BTC microstructure, funding or historical trajectory.
- Historical deficit remains an unexplained residual, approximately 0.12–0.19 R/trade relative to the diagnostic no-drift/cost intuition. Candidate explanations are not proven; do not select one without authorization/evidence.
- The historical cost-sign debt is explicitly **not** to be retrospectively corrected. A correction would require a formal methodology amendment before a new research run.

Calibration evidence in the closure report (development-only calibration, **not a holdout evaluation**):
- seed `20261007`;
- 100,000 observations; 8-candle horizon; +1.5R target; -1R invalidation;
- realistic intrabar high/low paths; ambiguous candles exercised;
- TARGET 29,438 / 99,263 clean = 29.6566%;
- INVALIDATION 49,592 / 99,263 = 49.9602%;
- TIME_EXIT 20,233 / 99,263 = 20.3832%;
- AMBIGUOUS 737 / 100,000 = 0.737%;
- gross mean R = -0.0000415.
Do not mistake this synthetic/development calibration for proof of a tradable edge.

### Diagnostic export already recorded

The Phase 3 closure report addendum states PR #53 merged as `039892c562ea768253b2da13da9fb8e2a328ecfa`.

On the frozen dataset:
- Validation: 8,759 observations; 3,790 clean eligible; 52 ambiguous; 4,917 non-ambiguous exclusions.
- Test: 17,536 observations; 8,964 clean eligible; 100 ambiguous; 8,472 non-ambiguous exclusions.
- All measured non-ambiguous exclusions were `SETUP_NON_ELIGIBLE`; no other requested exclusion category was observed.
- Warm-up and tail remain outside the ledger: 50 and 8 observations.
- Strategy gross state means:
  - Validation TARGET 1.175456 / INVALIDATION -1.322057 / TIME_EXIT -0.185503.
  - Test TARGET 1.212117 / INVALIDATION -1.285224 / TIME_EXIT -0.151064.
- RANDOM_ENTRY gross state means:
  - Validation TARGET 1.168500 / INVALIDATION -1.318539 / TIME_EXIT -0.109052.
  - Test TARGET 1.214028 / INVALIDATION -1.287649 / TIME_EXIT -0.055052.
The report states that no holdout observation was accessed and no historical result was rewritten. Verify current CI/PR and artifacts before asserting current branch state.

## 6. Funding archive and replay boundary

The documented frozen replay archive is Binance Vision BTCUSDT USDⓈ-M Futures monthly `fundingRate`, 2020-01 through 2025-12 (end-exclusive at 2026-01-01), 72 files / 6,576 rows. Canonical manifest SHA-256 reported in README: `137d7f4f0d41fbdae1b93d9aa3b50cf3193e91630eb46fc09262d8a53fbeaf8a`.

The loader is intended to fail closed if manifest schema, symbol, period, canonical hash, ZIP presence or per-ZIP SHA-256 is wrong. The archive does not include or access the final holdout interval. The replay is explicitly separate from immutable historical Phase 3 results; the exact funding archive used by the original historical run was not identified, so bit-for-bit reconstruction of the historical net result is not established. The frozen archive enables reproducible future replays; it does not rewrite the historical result.

The closure report says PR #54 merged as `e0d7b2ccc63d4d90e7d1833732a2cd550276b359`. Verify before relying on branch state.

## 7. TEL surveillance and abandoned approaches

TEL/USDT surveillance is read-only:
- KuCoin Spot is primary; MEXC is a cross-check.
- State vocabulary: `ENTRER` / `ATTENDRE` / `SORTIR` / `NE_PAS_ENTRER`.
- Fail-closed handling for degraded data.
- Required disclaimer: « Règles de surveillance, aucun edge statistique démontré (phase 3 : PAS D'EDGE). Ce n'est pas une prédiction. »

Monitor-v1 is descriptive market context only, separate from frozen `core-v1`, not wired into probability/expectancy/decision/research code, and does not change the Phase 3 verdict. Indicators listed: EMA200, ADX, DI spread, MACD histogram, Stochastic RSI, Bollinger %B/bandwidth, OBV trend, rolling VWAP deviation, Donchian position and confirmed swing support/resistance distances. Insufficient history must yield `null`; no imputation or look-ahead.

**TEL Grid was explicitly cancelled/abandoned** after Red Team analysis due to low order-book depth, liquidity risk and opportunity cost. Do not revive it, run it or make it a priority without explicit new authorization.

## 8. Quant research architecture / controls

Prior design work explored a probability-based Decision Engine (not arbitrary scoring), historical bucketized lookup, explicit STOP vs INVALIDATION semantics and a Payoff Gate based on expected value. Treat these as architecture topics to verify in code/docs, not permission to create a new strategy hypothesis.

Red Team must challenge at least:
1. look-ahead and point-in-time integrity;
2. explicit observation unit and overlapping/dependent samples;
3. independent feature definitions;
4. Asset/Instrument/Venue separation;
5. probability vs uncertainty;
6. intrabar ambiguity;
7. invalidation vs stop;
8. risk vs leverage;
9. liquidity as a hard gate;
10. fees, slippage and funding;
11. walk-forward/OOS validity;
12. untouched holdout;
13. experiment-selection bias;
14. immutable reproducibility;
15. simple baseline explanations;
16. ablation evidence;
17. availability of NO_TRADE and INSUFFICIENT_EVIDENCE;
18. explanation generated from the same snapshot as the decision.

Stop promotion on unresolved leakage, timestamp ambiguity, contradictory definitions or unverifiable results.

## 9. Prior engineering incidents and work to verify

These were mentioned in project history and must be checked against actual GitHub evidence; do not assume still open or already fixed:
- CI #309 / PR #46: TypeScript syntax error reported at `src/research/phase3-report.ts`, line 73.
- PR #55 and commit `05dce2b`.
- Runner catch-block error normalization to `API_UNAVAILABLE_OR_TIMEOUT`.
- Hash-chain preservation in the automation runner.
- Requirement to verify CI green before merging.
- Advanced research lab branch `research/advanced-quant-lab`.
- Intended `market-comparables/` and `tam-penetration/` directories.
- GitHub Telcoin commit ingestion fetcher.
- Strict Pydantic models, SQLite FTS5, tests and GitHub Actions.
- Isolation test prohibiting advanced_lab imports from `src/holdout/` or `src/terminal/`.

Historical requests also included export of exclusion diagnostics and state-wise R metrics; these are described in §5. Do not rerun research to reconstruct data absent from immutable artifacts. The closure report explicitly says the complete observation ledger was not preserved for retrospective reconstruction; measured categories must be reported as measured, not invented.

## 10. Current local-clone incident

Codex reported cloning the repository to:
`C:\Users\sabri\Desktop\crypto-quant-terminal`

It reported branch `main`, remote `origin/main`, and a Windows collision between `docs/ALERTS.md` and `docs/alerts.md`, after which Git appeared to show `docs/ALERTS.md` as modified.

This report is not independently verified. Before any repair:
- inspect `git status --short`, `git diff -- docs/ALERTS.md`, `git ls-files` and remote HEAD;
- compare the two case-sensitive paths against GitHub;
- preserve all local work;
- do not run `reset --hard`, `clean`, delete, rename or case-only rename without a reviewed non-destructive plan.
Report exact evidence and wait for approval before changing either path.

## 11. Roadmap and prioritization rules

### Immediate priority
1. Verify local clone and remote state, including the case-collision incident, without mutation.
2. Read this document and all relevant source docs.
3. Build a verified project chronology from commits, PRs, ADRs, artifacts and CI.
4. Report actual current state and differences between local branch and GitHub.
5. Identify the next explicitly authorized engineering task. Do not start a new research run.

### Ongoing engineering priorities (subject to source verification and explicit mission)
- Keep CI/test evidence reliable and reproducible.
- Keep funding archive versioned, hash-verified and fail-closed.
- Preserve hash-chain integrity in the automation runner.
- Keep the advanced research lab isolated from terminal and holdout code.
- Keep diagnostic/reporting changes separate from historical calculations.
- Improve TEL read-only entry-timing surveillance only within existing authorization; do not claim it has statistical edge.
- Ensure every task leaves a concise evidence-backed report and updates durable documentation where appropriate.

### Explicitly not authorized by this roadmap
- Accessing or consuming holdout data.
- Changing frozen dataset, Phase 3 ADR-0002 or historical outputs.
- Creating ADR-0003.
- New strategy hypotheses, parameter optimization or unapproved research runs.
- Re-enabling TEL Grid.
- Live order execution, exchange API credentials or automatic capital deployment.
- Destructive Git cleanup or unreviewed merges.

## 12. Architecture decisions to preserve

The repository's `docs/DECISIONS.md` lists:
- ADR-001 — Read-only V1.
- ADR-002 — Decision states include NO_TRADE and INSUFFICIENT_EVIDENCE.
- ADR-003 — Liquidity is a gate, not a score.
- ADR-004 — Invalidation is distinct from stop.
- ADR-005 — Probabilities require empirical grounding.
- ADR-006 — Version everything that can alter a decision.
- ADR-007 — V1 favors a small feature set.
- ADR-008 — GitHub is the source of truth; architecture changes require explicit documentation and review.

These numbered decisions are distinct from the separate Phase 3 `ADR-0002` referenced above. Do not conflate them.

## 13. Required reporting template

For every task, report:

1. **Mission and scope** — exact request and what was deliberately excluded.
2. **Initial state** — repository, branch, HEAD SHA, working-tree status.
3. **Evidence inspected** — file paths, commits, PRs, artifact hashes and CI links.
4. **Actions taken** — exact commands and files changed.
5. **Diff summary** — added/modified/deleted files; no hidden changes.
6. **Validation** — tests and CI with actual results, not assumptions.
7. **Integrity checks** — explicit confirmation that protected items were not changed or accessed, only when verified.
8. **Risks / unresolved questions** — distinguish facts from hypotheses.
9. **Next step** — one recommended action; do not execute out-of-scope work.

## 14. First action after reading this file

Perform a read-only inventory. Verify repository/branch/HEAD/remote/status and current CI. Inspect relevant documentation and the actual Phase 3 ADR path. Investigate the Windows case-collision without fixing it. Produce a factual chronology and a gap list.

Do not run research, edit protected artifacts, create a new strategy, or merge anything as part of this first action.

---

**Provenance note:** This file combines the current README and project documents with previously communicated project decisions and incident references. Some historical references are summaries pending independent verification. The repository artifacts, exact commit history, PR records and CI outputs remain the authority for claims about implementation state.
