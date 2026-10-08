"""Local SQLite/FTS5 engine for Experiment 001.

No network access, scraping, or external API calls are performed here.
Canonical tables are the source of truth; FTS5 is a synchronized index.
"""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Final, Sequence

from schemas.models import GitHubCommitRecord, RegulatoryTextRecord

SCHEMA_VERSION: Final[str] = "nlp-retrieval.sqlite.v2"


class NlpEngine:
    def __init__(self, database: str | Path = ":memory:") -> None:
        self.connection = sqlite3.connect(database)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self._initialize()

    def _initialize(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_metadata (
                schema_version TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY,
                source_type TEXT NOT NULL CHECK (source_type IN ('github_commit', 'regulatory_text')),
                source_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                published_at TEXT NOT NULL,
                url TEXT,
                content_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS github_commits (
                document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
                repository TEXT NOT NULL,
                sha TEXT NOT NULL UNIQUE,
                author TEXT NOT NULL,
                committed_at TEXT NOT NULL,
                message TEXT NOT NULL,
                url TEXT
            );

            CREATE TABLE IF NOT EXISTS regulatory_texts (
                document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
                jurisdiction TEXT NOT NULL,
                authority TEXT NOT NULL,
                reference TEXT NOT NULL UNIQUE,
                published_at TEXT NOT NULL,
                title TEXT NOT NULL,
                text TEXT NOT NULL,
                url TEXT
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                title,
                body,
                content='documents',
                content_rowid='id',
                tokenize='unicode61'
            );

            CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
                INSERT INTO documents_fts(rowid, title, body)
                VALUES (new.id, new.title, new.body);
            END;

            CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE OF title, body ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, title, body)
                VALUES ('delete', old.id, old.title, old.body);
                INSERT INTO documents_fts(rowid, title, body)
                VALUES (new.id, new.title, new.body);
            END;

            CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, title, body)
                VALUES ('delete', old.id, old.title, old.body);
            END;
            """
        )
        self.connection.execute(
            "INSERT OR IGNORE INTO schema_metadata(schema_version) VALUES (?)",
            (SCHEMA_VERSION,),
        )
        self.connection.commit()

    @staticmethod
    def _hash_text(source_id: str, content: str) -> str:
        return hashlib.sha256(f"{source_id}\n{content}".encode("utf-8")).hexdigest()

    def insert_github_commits(self, records: Sequence[GitHubCommitRecord]) -> list[int]:
        ids: list[int] = []
        with self.connection:
            for record in records:
                source_id = f"{record.repository}:{record.sha}"
                published_at = record.committed_at.isoformat()
                content_hash = self._hash_text(source_id, record.message)
                cursor = self.connection.execute(
                    """
                    INSERT INTO documents
                        (source_type, source_id, title, body, published_at, url, content_hash)
                    VALUES
                        ('github_commit', ?, ?, ?, ?, ?, ?)
                    """,
                    (source_id, record.message, record.message, published_at, record.url, content_hash),
                )
                document_id = int(cursor.lastrowid)
                ids.append(document_id)
                self.connection.execute(
                    """
                    INSERT INTO github_commits
                        (document_id, repository, sha, author, committed_at, message, url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (document_id, record.repository, record.sha, record.author, published_at, record.message, record.url),
                )
        return ids

    def insert_github_commit(self, record: GitHubCommitRecord) -> int:
        return self.insert_github_commits([record])[0]

    def insert_regulatory_text(self, record: RegulatoryTextRecord) -> int:
        source_id = f"{record.jurisdiction}:{record.authority}:{record.reference}"
        published_at = record.published_at.isoformat()
        content_hash = self._hash_text(source_id, record.text)
        with self.connection:
            cursor = self.connection.execute(
                """
                INSERT INTO documents
                    (source_type, source_id, title, body, published_at, url, content_hash)
                VALUES
                    ('regulatory_text', ?, ?, ?, ?, ?, ?)
                """,
                (source_id, record.title, record.text, published_at, record.url, content_hash),
            )
            document_id = int(cursor.lastrowid)
            self.connection.execute(
                """
                INSERT INTO regulatory_texts
                    (document_id, jurisdiction, authority, reference, published_at, title, text, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (document_id, record.jurisdiction, record.authority, record.reference, published_at, record.title, record.text, record.url),
            )
        return document_id

    def search(self, query: str) -> list[sqlite3.Row]:
        if not query.strip():
            return []
        phrase = '"' + query.replace('"', '""') + '"'
        return self.connection.execute(
            """
            SELECT d.id, d.source_type, d.source_id, d.title, d.body,
                   bm25(documents_fts) AS score
            FROM documents_fts
            JOIN documents AS d ON d.id = documents_fts.rowid
            WHERE documents_fts MATCH ?
            ORDER BY score ASC, d.id ASC
            """,
            (phrase,),
        ).fetchall()

    def close(self) -> None:
        self.connection.close()
