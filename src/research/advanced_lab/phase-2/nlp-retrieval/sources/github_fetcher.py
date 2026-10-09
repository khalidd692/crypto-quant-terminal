from __future__ import annotations

import hashlib
import json
import os
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from pydantic import ValidationError

from schemas.models import GitHubCommitRecord

GITHUB_API = "https://api.github.com"
USER_AGENT = "crypto-quant-advanced-lab/experiment-001"
DEFAULT_REPOSITORY = "telcoin/telcoin"
DEFAULT_TIMEOUT_SECONDS = 20
MAX_RESPONSE_BYTES = 10 * 1024 * 1024


class GitHubFetchError(RuntimeError):
    """Raised when a configured GitHub source cannot be ingested safely."""


@dataclass(frozen=True)
class GitHubFetchResult:
    requested_repository: str
    repository: str
    records: list[GitHubCommitRecord]
    raw_json: bytes
    raw_sha256: str
    fetched_at: datetime
    fallback_used: bool
    received_count: int
    rejections: list[str]


def configured_repository(repository: str | None = None) -> str:
    value = (repository or os.getenv("NLP_GITHUB_REPOSITORY") or DEFAULT_REPOSITORY).strip()
    parts = value.split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("GitHub repository must be owner/name")
    if any(part in {".", ".."} for part in parts):
        raise ValueError("GitHub repository contains an invalid path component")
    return value


def _request_json(url: str, *, timeout: float = DEFAULT_TIMEOUT_SECONDS) -> bytes:
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError:
        raise
    except (TimeoutError, socket.timeout) as exc:
        raise GitHubFetchError(f"GitHub request timed out after {timeout:g}s: {url}") from exc
    except URLError as exc:
        raise GitHubFetchError(f"GitHub request failed: {exc.reason}") from exc
    except OSError as exc:
        raise GitHubFetchError(f"GitHub transport error: {exc}") from exc

    if len(raw) > MAX_RESPONSE_BYTES:
        raise GitHubFetchError(f"GitHub response exceeded {MAX_RESPONSE_BYTES} bytes: {url}")
    if not raw:
        raise GitHubFetchError(f"GitHub returned an empty HTTP body: {url}")
    return raw


def _decode_json(raw: bytes, context: str) -> Any:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError) as exc:
        raise GitHubFetchError(f"{context} returned invalid JSON") from exc


def _verify_repository(repository: str) -> None:
    url = f"{GITHUB_API}/repos/{quote(repository, safe='/')}"
    raw = _request_json(url)
    payload = _decode_json(raw, "GitHub repository verification")
    full_name = payload.get("full_name") if isinstance(payload, dict) else None
    if not isinstance(full_name, str) or full_name.casefold() != repository.casefold():
        raise GitHubFetchError(f"GitHub repository verification failed for {repository}")


def _validation_message(exc: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in error.get('loc', ()))}: {error.get('msg', 'invalid value')}"
        for error in exc.errors(include_url=False)
    )[:500]


def _parse(payload: Any, repository: str) -> tuple[list[GitHubCommitRecord], list[str]]:
    if not isinstance(payload, list):
        raise GitHubFetchError("GitHub commits payload is not a list")
    if not payload:
        raise GitHubFetchError("GitHub commits payload is empty")

    records: list[GitHubCommitRecord] = []
    rejections: list[str] = []
    for index, item in enumerate(payload, start=1):
        sha_hint = item.get("sha", "unknown") if isinstance(item, dict) else "unknown"
        try:
            if not isinstance(item, dict):
                raise ValueError("commit item is not an object")
            commit = item.get("commit")
            if not isinstance(commit, dict):
                raise ValueError("nested commit object is missing")
            author = commit.get("author")
            committer = commit.get("committer")
            if not isinstance(author, dict):
                raise ValueError("commit author metadata is missing")
            if not isinstance(committer, dict):
                raise ValueError("commit committer metadata is missing")
            committed_at_raw = committer.get("date")
            if not isinstance(committed_at_raw, str) or not committed_at_raw.strip():
                raise ValueError("committer.date is missing")
            committed_at = datetime.fromisoformat(committed_at_raw.replace("Z", "+00:00"))
            candidate = {
                "repository": repository,
                "sha": item.get("sha"),
                "author": author.get("name"),
                "committed_at": committed_at,
                "message": commit.get("message"),
                "url": item.get("html_url"),
            }
            # Every individual API record passes the strict Pydantic boundary.
            records.append(GitHubCommitRecord.model_validate(candidate, strict=True))
        except ValidationError as exc:
            rejections.append(f"item={index} sha={sha_hint}: Pydantic rejected record: {_validation_message(exc)}")
        except (AttributeError, TypeError, ValueError) as exc:
            rejections.append(f"item={index} sha={sha_hint}: malformed commit: {str(exc)[:300]}")

    return records, rejections


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
    candidates = [target] + ([fallback] if allow_404_fallback and fallback else [])
    for index, current in enumerate(candidates):
        try:
            _verify_repository(current)
            url = f"{GITHUB_API}/repos/{quote(current, safe='/')}/commits?per_page={limit}&page=1"
            raw = _request_json(url)
            payload = _decode_json(raw, "GitHub commits endpoint")
            records, rejections = _parse(payload, current)
            return GitHubFetchResult(
                requested_repository=target,
                repository=current,
                records=records,
                raw_json=raw,
                raw_sha256=hashlib.sha256(raw).hexdigest(),
                fetched_at=fetched_at,
                fallback_used=index == 1,
                received_count=len(payload),
                rejections=rejections,
            )
        except HTTPError as exc:
            # Fallback is intentionally restricted to a definitive 404.
            # Timeouts, rate limits, authentication failures and server errors fail closed.
            if exc.code == 404 and allow_404_fallback and index == 0:
                continue
            raise GitHubFetchError(f"GitHub HTTP {exc.code} while accessing {current}") from exc

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
                "records_received": result.received_count,
                "records_validated": len(result.records),
                "records_rejected": len(result.rejections),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return raw_path, meta_path
