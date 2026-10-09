"""Executable real-data ingestion for Experiment 001."""
from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
from pathlib import Path

ADVANCED_LAB_ROOT = Path(__file__).resolve().parent
NLP_ROOT = ADVANCED_LAB_ROOT / "phase-2" / "nlp-retrieval"
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))

from sources.github_fetcher import GitHubFetchError, fetch_latest_commits, save_raw_result
from sqlite.engine import NlpEngine

KEYWORDS = ("fix", "security", "MTL", "audit", "merge")
DEFAULT_FALLBACK_REPOSITORY = "ethereum/go-ethereum"
LOGGER = logging.getLogger("advanced_lab.github_ingestion")


def _already_indexed(engine: NlpEngine, repository: str, sha: str) -> bool:
    row = engine.connection.execute(
        "SELECT 1 FROM github_commits WHERE repository = ? AND sha = ? LIMIT 1",
        (repository, sha),
    ).fetchone()
    return row is not None


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and index the latest public GitHub commits.")
    parser.add_argument("--repository", help="GitHub owner/name (default: telcoin/telcoin or GITHUB_REPOSITORY)")
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
    try:
        result = fetch_latest_commits(
            args.repository,
            allow_404_fallback=not args.no_fallback,
            fallback_repository=args.fallback_repository,
        )
    except (GitHubFetchError, ValueError) as exc:
        LOGGER.error("Ingestion aborted fail-closed: %s", exc)
        return 2

    raw_path, meta_path = save_raw_result(result, args.raw_dir)
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
        LOGGER.error("Ingestion aborted fail-closed: zero commits passed strict Pydantic validation")
        return 3

    database_path = args.database
    if database_path != ":memory:":
        Path(database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)

    engine = NlpEngine(database_path)
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

        print(f"Commits inserted: {inserted}")
        print(f"Already indexed (idempotent skip): {duplicates}")
        print(f"Database insertion rejections: {database_rejections}")
        if inserted == 0 and duplicates == 0:
            LOGGER.error("Ingestion aborted: no accepted commit was inserted or already indexed")
            return 4

        for keyword in KEYWORDS:
            hits = engine.search(keyword)
            print(f'\nFTS5 "{keyword}": {len(hits)} result(s)')
            for hit in hits:
                print(f'  [{hit["score"]:.4f}] {hit["source_id"]} — {hit["title"]}')
                if hit["url"]:
                    print(f'    {hit["url"]}')
    finally:
        engine.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
