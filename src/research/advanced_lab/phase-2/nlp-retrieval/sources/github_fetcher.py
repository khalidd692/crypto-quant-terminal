"""GitHub REST ingestion adapter for Experiment 001.

Network access is limited to the public GitHub REST API through urllib.
Every API record crosses the strict Pydantic boundary before it can reach
the SQLite engine. Unexpected payloads fail closed.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

NLP_ROOT = Path(__file__).resolve().parents[1]
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))

from schemas.models import GitHubCommitRecord  # noqa: E402

DEFAULT_REPOSITORIES = (
    "telcoin/telcoin",
    "ethereum/go-ethereum",
)
GITHUB_API = "https://api.github.com"
USER_AGENT = "crypto-quant-terminal-advanced-lab/experiment-001"


class GitHubFetchError(RuntimeError):
    """Raised when no configured public GitHub source can be ingested."""


def _require_string(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"GitHub payload field {field!r} must be a string")
    return value


def _require_mapping(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError(f"GitHub payload field {field!r} must be an object")
    return value


def _parse_github_datetime(value: Any, field: str) -> datetime:
    raw = _require_string(value, field)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"GitHub payload field {field!r} is not ISO-8601") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"GitHub payload field {field!r} must include a timezone")
    return parsed


def _map_commit(payload: Any, repository: str) -> GitHubCommitRecord:
    item = _require_mapping(payload, "commit item")
    commit = _require_mapping(item.get("commit"), "commit.commit")
    author = _require_mapping(commit.get("author"), "commit.author")

    return GitHubCommitRecord(
        repository=repository,
        sha=_require_string(item.get("sha"), "sha"),
        author=_require_string(author.get("name"), "commit.author.name"),
        committed_at=_parse_github_datetime(
            author.get("date"), "commit.author.date"
        ),
        message=_require_string(commit.get("message"), "commit.message"),
        url=_require_string(item.get("html_url"), "html_url"),
    )


def _fetch_json(repository: str, limit: int) -> Any:
    encoded_repository = quote(repository, safe="/")
    url = f"{GITHUB_API}/repos/{encoded_repository}/commits?per_page={limit}&page=1"
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def fetch_latest_commits(
    limit: int = 30,
    repositories: tuple[str, ...] = DEFAULT_REPOSITORIES,
) -> tuple[str, list[GitHubCommitRecord]]:
    if limit != 30:
        raise ValueError("Experiment 001 ingestion is fixed to exactly 30 commits")
    if not repositories:
        raise ValueError("At least one GitHub repository must be configured")

    failures: list[str] = []
    for repository in repositories:
        try:
            payload = _fetch_json(repository, limit)
        except HTTPError as exc:
            if exc.code in (403, 404):
                failures.append(f"{repository}: HTTP {exc.code}")
                continue
            raise
        except URLError as exc:
            failures.append(f"{repository}: {exc.reason}")
            continue

        if not isinstance(payload, list):
            raise TypeError("GitHub commits endpoint returned a non-list payload")
        if len(payload) > limit:
            raise ValueError("GitHub commits endpoint returned more than requested")

        records = [_map_commit(item, repository) for item in payload]
        return repository, records

    raise GitHubFetchError(
        "No configured GitHub repository was accessible: " + "; ".join(failures)
    )
