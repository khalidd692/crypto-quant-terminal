"""Executable real-data ingestion for Experiment 001."""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
ADVANCED_LAB_ROOT = Path(__file__).resolve().parent
NLP_ROOT = ADVANCED_LAB_ROOT / "phase-2" / "nlp-retrieval"
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))
from sources.github_fetcher import fetch_latest_commits, save_raw_result
from sqlite.engine import NlpEngine
KEYWORDS = ("fix", "security", "merge", "MTL", "audit")
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository")
    parser.add_argument("--allow-404-fallback", action="store_true")
    parser.add_argument("--fallback-repository")
    parser.add_argument("--raw-dir", default=str(ADVANCED_LAB_ROOT / "datasets" / "raw" / "github"))
    args = parser.parse_args()
    result = fetch_latest_commits(args.repository, allow_404_fallback=args.allow_404_fallback, fallback_repository=args.fallback_repository)
    raw_path, meta_path = save_raw_result(result, args.raw_dir)
    engine = NlpEngine()
    try:
        ids = engine.insert_github_commits(result.records)
        print(f"GitHub source: {result.repository}")
        print(f"Requested repository: {result.requested_repository}")
        print(f"Fallback used: {str(result.fallback_used).lower()}")
        print(f"Commits fetched: {len(result.records)}")
        print(f"Commits inserted: {len(ids)}")
        print(f"Raw JSON: {raw_path}")
        print(f"Raw SHA256: {result.raw_sha256}")
        print(f"Fetched at: {result.fetched_at.isoformat()}")
        print(f"Raw metadata: {meta_path}")
        for keyword in KEYWORDS:
            hits = engine.search(keyword)
            print(f'\nFTS "{keyword}": {len(hits)} result(s)')
            for hit in hits:
                print(f'  [{hit["score"]:.4f}] {hit["source_id"]} — {hit["title"]}')
    finally:
        engine.close()
if __name__ == "__main__":
    main()
