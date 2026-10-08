from typing import Annotated
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

SHA40 = Annotated[str, Field(min_length=40, max_length=40, pattern=r"^[0-9a-fA-F]{40}$")]

class GitHubCommitRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    repository: str = Field(min_length=1)
    sha: SHA40
    author: str = Field(min_length=1)
    committed_at: AwareDatetime
    message: str = Field(min_length=1)
    url: str | None = None

class RegulatoryTextRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    jurisdiction: str = Field(min_length=1)
    authority: str = Field(min_length=1)
    reference: str = Field(min_length=1)
    published_at: AwareDatetime
    title: str = Field(min_length=1)
    text: str = Field(min_length=1)
    url: str | None = None
