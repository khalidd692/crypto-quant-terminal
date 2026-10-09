"""Executable real-data ingestion for Experiment 001, with a mobile-readable report."""
from __future__ import annotations

import argparse
import logging
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ADVANCED_LAB_ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = ADVANCED_LAB_ROOT.parents[2]
NLP_ROOT = ADVANCED_LAB_ROOT / "phase-2" / "nlp-retrieval"
REPORT_PATH = REPOSITORY_ROOT / "reports" / "latest_nlp_signals.md"
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))

from sources.github_fetcher import (  # noqa: E402
    DEFAULT_REPOSITORY,
    GitHubFetchError,
    fetch_latest_commits,
    save_raw_result,
)
from sqlite.engine import NlpEngine  # noqa: E402

KEYWORDS = ("fix", "security", "MTL", "audit", "merge")
DEFAULT_FALLBACK_REPOSITORY = "ethereum/go-ethereum"
LOGGER = logging.getLogger("advanced_lab.github_ingestion")


def _already_indexed(engine: NlpEngine, repository: str, sha: str) -> bool:
    row = engine.connection.execute(
        "SELECT 1 FROM github_commits WHERE repository = ? AND sha = ? LIMIT 1",
        (repository, sha),
    ).fetchone()
    return row is not None


def _markdown_safe(value: Any) -> str:
    """Keep untrusted commit text on one Markdown line."""
    return " ".join(str(value).replace("\r", " ").replace("\n", " ").split())


def _render_report(
    scan_started: datetime,
    status: str,
    details: dict[str, Any],
    keyword_results: dict[str, list[dict[str, Any]]],
) -> str:
    lines = [
        "# Latest NLP surveillance signals",
        "",
        f"- **Date du scan (UTC)** : {scan_started.isoformat()}",
        f"- **Statut de l’aspiration** : **{status}**",
        "",
        "## Résumé de l’ingestion",
        "",
    ]
    for key, value in details.items():
        lines.append(f"- **{_markdown_safe(key)}** : {_markdown_safe(value)}")
    lines.extend(["", "## Recherche SQLite FTS5", ""])
    for keyword in KEYWORDS:
        hits = keyword_results.get(keyword)
        if hits is None:
            lines.extend([f"### `{keyword}`", "", "Recherche non exécutée : ingestion interrompue avant l’interrogation FTS5.", ""])
            continue
        lines.extend([f"### `{keyword}` — {len(hits)} résultat(s)", ""])
        if not hits:
            lines.extend(["Aucun commit correspondant dans l’index local.", ""])
            continue
        for hit in hits:
            title = _markdown_safe(hit.get("title", "(sans titre)"))
            source_id = _markdown_safe(hit.get("source_id", ""))
            score = hit.get("score", 0.0)
            try:
                score_text = f"{float(score):.4f}"
            except (TypeError, ValueError):
                score_text = "n/a"
            url = _markdown_safe(hit.get("url", ""))
            suffix = f" — [{url}]({url})" if url.startswith(("https://", "http://")) else ""
            lines.append(f"- **{title}** (score FTS5 : {score_text}; source : `{source_id}`){suffix}")
        lines.append("")
    lines.extend([
        "---",
        "",
        "Rapport généré automatiquement par `run_github_ingestion.py`. Les résultats sont des correspondances textuelles, pas une preuve d’activité ou de sécurité du projet.",
        "",
    ])
    return "\n".join(lines)


def _write_report(
    scan_started: datetime,
    status: str,
    details: dict[str, Any],
    keyword_results: dict[str, list[dict[str, Any]]],
) -> Path:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        _render_report(scan_started, status, details, keyword_results),
        encoding="utf-8",
    )
    return REPORT_PATH


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and index the latest public GitHub commits.")
    parser.add_argument("--repository", help="GitHub owner/name (default: telcoin/telcoin or NLP_GITHUB_REPOSITORY)")
    parser.add_argument(
        "--no-fallback",
        action="store_true",
        help="Disable fallback to ethereum/go-ethereum when the primary repository returns HTTP 404",
    )
    parser.add_argument(
        "--fallback-repository",
        default=DEFAULT_FALLBACK_REPOSITORY,
        help=f"Fallback repository used only for a primary HTTP 404 (default: {DEFAULT_FALLBACK_REPOSITORY})",
    )
    parser.add_argument(
        "--raw-dir",
        default=str(ADVANCED_LAB_ROOT / "datasets" / "raw" / "github"),
        help="Directory for raw JSON snapshots and metadata",
    )
    parser.add_argument(
        "--database",
        default=str(ADVANCED_LAB_ROOT / "datasets" / "processed" / "nlp-retrieval.sqlite3"),
        help="Local SQLite database path",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
    scan_started = datetime.now(timezone.utc)
    requested_repository = args.repository or os.getenv("NLP_GITHUB_REPOSITORY") or DEFAULT_REPOSITORY
    details: dict[str, Any] = {
        "Dépôt demandé": requested_repository,
        "Mots-clés suivis": ", ".join(KEYWORDS),
    }
    keyword_results: dict[str, list[dict[str, Any]]] = {}

    def finish(status: str, code: int, reason: str | None = None) -> int:
        report_details = dict(details)
        if reason:
            report_details["Détail"] = reason
        try:
            report_path = _write_report(scan_started, status, report_details, keyword_results)
        except OSError as exc:
            LOGGER.error("Impossible d’écrire le rapport mobile : %s", exc)
            print(f"Rapport non écrit : {exc}", file=sys.stderr)
            return 7 if code == 0 else code
        print(f"Statut de l’aspiration : {status}")
        print(f"Rapport mobile : {report_path}")
        if reason:
            LOGGER.error("%s", reason)
        return code

    try:
        result = fetch_latest_commits(
            args.repository,
            allow_404_fallback=not args.no_fallback,
            fallback_repository=args.fallback_repository,
        )
    except (GitHubFetchError, ValueError) as exc:
        return finish("FAIL-CLOSED", 2, f"Récupération GitHub interrompue : {exc}")

    details.update({
        "Dépôt utilisé": result.repository,
        "Fallback utilisé": str(result.fallback_used).lower(),
        "Commits reçus": result.received_count,
        "Commits validés par Pydantic": len(result.records),
        "Commits rejetés par Pydantic": len(result.rejections),
        "SHA-256 de la réponse brute": result.raw_sha256,
        "Horodatage de récupération (UTC)": result.fetched_at.isoformat(),
    })
    try:
        raw_path, meta_path = save_raw_result(result, args.raw_dir)
    except OSError as exc:
        return finish("FAIL-CLOSED", 5, f"Persistance de la réponse brute impossible : {exc}")
    details["Snapshot JSON brut"] = raw_path
    details["Métadonnées du snapshot"] = meta_path
    for rejection in result.rejections:
        LOGGER.warning("Commit rejected: %s", rejection)

    print(f"GitHub source: {result.repository}")
    print(f"Requested repository: {result.requested_repository}")
    print(f"Fallback used: {str(result.fallback_used).lower()}")
    print(f"Commits received: {result.received_count}")
    print(f"Commits accepted by Pydantic: {len(result.records)}")
    print(f"Commits rejected by Pydantic: {len(result.rejections)}")
    print(f"Raw JSON: {raw_path}")
    print(f"Raw SHA256: {result.raw_sha256}")
    print(f"Fetched at: {result.fetched_at.isoformat()}")
    print(f"Raw metadata: {meta_path}")

    if not result.records:
        return finish("FAIL-CLOSED", 3, "Zéro commit n’a passé la validation Pydantic stricte.")

    database_path = args.database
    if database_path != ":memory:":
        database_path = str(Path(database_path).expanduser())
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        engine = NlpEngine(database_path)
    except (sqlite3.Error, OSError) as exc:
        return finish("FAIL-CLOSED", 6, f"Initialisation de SQLite impossible : {exc}")

    inserted = 0
    duplicates = 0
    database_rejections = 0
    try:
        for record in result.records:
            if _already_indexed(engine, record.repository, record.sha):
                duplicates += 1
                continue
            try:
                engine.insert_github_commit(record)
                inserted += 1
            except (sqlite3.Error, ValueError) as exc:
                database_rejections += 1
                LOGGER.warning(
                    "Commit not inserted; continuing: sha=%s error=%s",
                    record.sha,
                    str(exc)[:300],
                )

        details.update({
            "Commits insérés": inserted,
            "Déjà indexés (ignorés de façon idempotente)": duplicates,
            "Rejets à l’insertion SQLite": database_rejections,
        })
        print(f"Commits inserted: {inserted}")
        print(f"Already indexed (idempotent skip): {duplicates}")
        print(f"Database insertion rejections: {database_rejections}")
        if inserted == 0 and duplicates == 0:
            return finish("FAIL-CLOSED", 4, "Aucun commit accepté n’a été inséré ou déjà indexé.")

        for keyword in KEYWORDS:
            hits = engine.search(keyword)
            keyword_results[keyword] = hits
            print(f'\nFTS5 "{keyword}": {len(hits)} result(s)')
            for hit in hits:
                print(f'  [{hit["score"]:.4f}] {hit["source_id"]} — {hit["title"]}')
                if hit["url"]:
                    print(f'    {hit["url"]}')
    except sqlite3.Error as exc:
        return finish("FAIL-CLOSED", 6, f"Erreur SQLite pendant l’indexation ou la recherche : {exc}")
    finally:
        engine.close()

    return finish("SUCCÈS", 0)


if __name__ == "__main__":
    raise SystemExit(main())
