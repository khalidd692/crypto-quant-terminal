"""Executable real-data ingestion for Experiment 001."""

from __future__ import annotations

import sys
from pathlib import Path

ADVANCED_LAB_ROOT = Path(__file__).resolve().parent
NLP_ROOT = ADVANCED_LAB_ROOT / "phase-2" / "nlp-retrieval"
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))

from sources.github_fetcher import fetch_latest_commits  # noqa: E402
from sqlite.engine import NlpEngine  # noqa: E402

KEYWORDS = ("fix", "security", "merge", "MTL", "audit")
DATABASE = ":memory:"


def main() -> None:
    repository, records = fetch_latest_commits(limit=30)

    engine = NlpEngine(DATABASE)
    inserted = 0
    try:
        for record in records:
            engine.insert_github_commit(record)
            inserted += 1

        print(f"GitHub source: {repository}")
        print(f"Commits fetched: {len(records)}")
        print(f"Commits inserted: {inserted}")

        for keyword in KEYWORDS:
            hits = engine.search(keyword)
            print(f'\nFTS "{keyword}": {len(hits)} result(s)')
            for hit in hits:
                print(
                    f'  [{hit["score"]:.4f}] '
                    f'{hit["source_id"]} — {hit["title"]}'
                )
    finally:
        engine.close()


if __name__ == "__main__":
    main()
