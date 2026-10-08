from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import MagicMock,patch
import pytest
from pydantic import ValidationError
NLP_ROOT=Path(__file__).resolve().parents[1]/"src"/"research"/"advanced_lab"/"phase-2"/"nlp-retrieval";sys.path.insert(0,str(NLP_ROOT))
from sources.github_fetcher import GitHubFetchError,fetch_latest_commits,save_raw_result
from schemas.models import GitHubCommitRecord
from sqlite.engine import NlpEngine
def commit_payload(sha:str="a"*40,message:str="Added MTL license integration",committer_date:str="2026-10-08T00:00:01Z"):
    return [{"sha":sha,"html_url":"https://github.com/example/research/commit/"+sha,"commit":{"message":message,"author":{"name":"author","date":"2026-10-07T00:00:01Z"},"committer":{"name":"committer","date":committer_date}}}]
def response(data):
    r=MagicMock();r.__enter__.return_value=r;r.read.return_value=json.dumps(data).encode();return r
def test_models_validate_sha_and_aware_datetime():
    with pytest.raises(ValidationError):GitHubCommitRecord(repository="example/research",sha="abc",author="a",committed_at=datetime.now(),message="x")
    with pytest.raises(ValidationError):GitHubCommitRecord(repository="example/research",sha="g"*40,author="a",committed_at=datetime.now(timezone.utc),message="x")
def test_duplicate_messages_are_allowed_and_hashes_are_source_specific():
    engine=NlpEngine();records=[GitHubCommitRecord(repository="example/research",sha="a"*40,author="a",committed_at=datetime.now(timezone.utc),message="MTL"),GitHubCommitRecord(repository="example/research",sha="b"*40,author="a",committed_at=datetime.now(timezone.utc),message="MTL")]
    try:
        ids=engine.insert_github_commits(records);assert len(ids)==2
        hashes=[r[0] for r in engine.connection.execute("select content_hash from documents order by id")];assert len(set(hashes))==2
    finally:engine.close()
def test_empty_payload_fails():
    with patch("sources.github_fetcher.urlopen",side_effect=[response({"full_name":"example/research"}),response([])]):
        with pytest.raises(GitHubFetchError,match="empty"):fetch_latest_commits("example/research")
def test_malformed_payload_fails():
    with patch("sources.github_fetcher.urlopen",side_effect=[response({"full_name":"example/research"}),response({"bad":"payload"})]):
        with pytest.raises(GitHubFetchError,match="not a list"):fetch_latest_commits("example/research")
def http_error(code):
    from urllib.error import HTTPError
    return HTTPError("https://api.github.com",code,"error",{},None)
def test_404_fallback_only_when_explicit_and_traced():
    with patch("sources.github_fetcher.urlopen",side_effect=[http_error(404),response({"full_name":"fallback/research"}),response(commit_payload())]):
        result=fetch_latest_commits("missing/research",allow_404_fallback=True,fallback_repository="fallback/research");assert result.fallback_used is True;assert result.repository=="fallback/research"
def test_403_fails_without_fallback():
    with patch("sources.github_fetcher.urlopen",side_effect=http_error(403)):
        with pytest.raises(GitHubFetchError,match="403"):fetch_latest_commits("example/research",allow_404_fallback=True,fallback_repository="fallback/research")
def test_timeout_fails():
    with patch("sources.github_fetcher.urlopen",side_effect=TimeoutError()):
        with pytest.raises(GitHubFetchError,match="timed out"):fetch_latest_commits("example/research")
def test_committed_at_uses_committer_date_and_raw_metadata():
    with patch("sources.github_fetcher.urlopen",side_effect=[response({"full_name":"example/research"}),response(commit_payload())]):
        result=fetch_latest_commits("example/research")
    assert result.records[0].committed_at.isoformat()=="2026-10-08T00:00:01+00:00";assert result.raw_sha256
def test_search_mtl_returns_expected_result():
    engine=NlpEngine()
    try:
        record=GitHubCommitRecord(repository="example/research",sha="a"*40,author="a",committed_at=datetime.now(timezone.utc),message="Added MTL license integration")
        doc_id=engine.insert_github_commit(record);hits=engine.search("MTL");assert any(row["id"]==doc_id for row in hits)
    finally:engine.close()
def test_http_429_and_5xx_fail():
    for code in (429,500,502,503):
        with patch("sources.github_fetcher.urlopen",side_effect=http_error(code)):
            with pytest.raises(GitHubFetchError,match=str(code)):fetch_latest_commits("example/research")
def test_url_error_fails():
    from urllib.error import URLError
    with patch("sources.github_fetcher.urlopen",side_effect=URLError("network down")):
        with pytest.raises(GitHubFetchError,match="network down"):fetch_latest_commits("example/research")
def test_batch_is_atomic_on_failure():
    engine=NlpEngine();now=datetime.now(timezone.utc)
    first=GitHubCommitRecord(repository="example/research",sha="a"*40,author="a",committed_at=now,message="one")
    duplicate_sha=GitHubCommitRecord(repository="example/research",sha="a"*40,author="a",committed_at=now,message="two")
    try:
        with pytest.raises(Exception):engine.insert_github_commits([first,duplicate_sha])
        assert engine.connection.execute("select count(*) from documents").fetchone()[0]==0
    finally:engine.close()
def test_raw_json_is_saved_with_sha_and_fetched_at(tmp_path):
    with patch("sources.github_fetcher.urlopen",side_effect=[response({"full_name":"example/research"}),response(commit_payload())]):
        result=fetch_latest_commits("example/research")
    raw,meta=save_raw_result(result,tmp_path)
    assert raw.read_bytes()==result.raw_json
    metadata=json.loads(meta.read_text());assert metadata["sha256"]==result.raw_sha256;assert metadata["fetched_at"]==result.fetched_at.isoformat()
