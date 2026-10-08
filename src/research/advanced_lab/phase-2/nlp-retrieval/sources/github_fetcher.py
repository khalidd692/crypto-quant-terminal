from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from schemas.models import GitHubCommitRecord

GITHUB_API = "https://api.github.com"
USER_AGENT = "crypto-quant-advanced-lab/experiment-001"
DEFAULT_REPOSITORY = "telcoin/telcoin"


class GitHubFetchError(RuntimeError):
    """Raised when a configured GitHub source cannot be ingested."""


@dataclass(frozen=True)
class GitHubFetchResult:
    requested_repository: str
    repository: str
    records: list[GitHubCommitRecord]
    raw_json: bytes
    raw_sha256: str
    fetched_at: datetime
    fallback_used: bool


def configured_repository(repository: str | None = None) -> str:
    value = (repository or os.getenv("GITHUB_REPOSITORY") or DEFAULT_REPOSITORY).strip()
    parts = value.split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("GitHub repository must be owner/name")
    return value


def _request_json(url: str) -> bytes:
    request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT}, method="GET")
    try:
        with urlopen(request, timeout=20) as response:
            return response.read()
    except HTTPError:
        raise
    except TimeoutError as exc:
        raise GitHubFetchError("GitHub request timed out") from exc
    except URLError as exc:
        raise GitHubFetchError(f"GitHub request failed: {exc.reason}") from exc


def _verify_repository(repository: str) -> None:
    raw = _request_json(f"{GITHUB_API}/repos/{quote(repository, safe='/')}")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise GitHubFetchError("GitHub repository verification returned invalid JSON") from exc
    if not isinstance(payload, dict) or payload.get("full_name") != repository:
        raise GitHubFetchError("GitHub repository verification failed")


def _parse(payload: Any, repository: str) -> list[GitHubCommitRecord]:
    if not isinstance(payload, list):
        raise GitHubFetchError("GitHub commits payload is not a list")
    if not payload:
        raise GitHubFetchError("GitHub commits payload is empty")
    records: list[GitHubCommitRecord] = []
    for item in payload:
        if not isinstance(item, dict) or not isinstance(item.get("commit"), dict):
            raise GitHubFetchError("GitHub commits payload is malformed")
        commit = item["commit"]
        author = commit.get("author")
        committer = commit.get("committer")
        if not isinstance(author, dict) or not isinstance(committer, dict):
            raise GitHubFetchError("GitHub commit identity payload is malformed")
        try:
            records.append(
                GitHubCommitRecord(
                    repository=repository,
                    sha=item.get("sha"),
                    author=author.get("name"),
                    committed_at=datetime.fromisoformat(committer.get("date").replace("Z", "+00:00")),
                    message=commit.get("message"),
                    url=item.get("html_url"),
                )
            )
        except (AttributeError, TypeError, ValueError) as exc:
            raise GitHubFetchError("GitHub commits payload is malformed") from exc
    return records


def fetch_latest_commits(
    repository: str | None = None,
    *,
    allow_404_fallback: bool = False,
    fallback_repository: str | None = None,
    limit: int = 30,
) -> GitHubFetchResult:
    if limit != 30:
        raise ValueError("Experiment 001 ingestion is fixed to exactly 30 commits")
    target = configured_repository(repository)
    fallback = configured_repository(fallback_repository) if fallback_repository else None
    if allow_404_fallback and not fallback:
        raise ValueError("An explicit fallback repository is required when fallback is enabled")

    fetched_at = datetime.now(timezone.utc)
    candidates = [target] + ([fallback] if allow_404_fallback else [])
    for index, current in enumerate(candidates):
        try:
            _verify_repository(current)
            raw = _request_json(f"{GITHUB_API}/repos/{quote(current, safe='/')}/commits?per_page={limit}&page=1")
            records = _parse(json.loads(raw), current)
            return GitHubFetchResult(target, current, records, raw, hashlib.sha256(raw).hexdigest(), fetched_at, index == 1)
        except HTTPError as exc:
            if exc.code == 404 and allow_404_fallback and index == 0:
                continue
            raise GitHubFetchError(f"GitHub HTTP {exc.code}") from exc
    raise GitHubFetchError("GitHub primary repository returned 404 and fallback was unavailable")


def save_raw_result(result: GitHubFetchResult, directory: str | Path) -> tuple[Path, Path]:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    stem = result.repository.replace("/", "__") + "__" + result.raw_sha256
    raw_path = directory / f"{stem}.json"
    meta_path = directory / f"{stem}.meta.json"
    raw_path.write_bytes(result.raw_json)
    meta_path.write_text(
        json.dumps(
            {
                "repository": result.repository,
                "requested_repository": result.requested_repository,
                "sha256": result.raw_sha256,
                "fetched_at": result.fetched_at.isoformat(),
                "fallback_used": result.fallback_used,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return raw_path, meta_path
