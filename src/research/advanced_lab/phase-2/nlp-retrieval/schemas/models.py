"""Strict Pydantic boundary models for Experiment 001."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GitHubCommitRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    repository: str
    sha: str
    author: str
    committed_at: datetime
    message: str
    url: str | None = None


class RegulatoryTextRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    jurisdiction: str
    authority: str
    reference: str
    published_at: datetime
    title: str
    text: str
    url: str | None = None
