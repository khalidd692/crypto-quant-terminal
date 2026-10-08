"""Local proof of concept for the Experiment 001 engine."""
import sys
from datetime import datetime,timezone
from pathlib import Path
from pydantic import ValidationError
NLP_ROOT=Path(__file__).resolve().parents[1]/"src"/"research"/"advanced_lab"/"phase-2"/"nlp-retrieval";sys.path.insert(0,str(NLP_ROOT))
from schemas.models import GitHubCommitRecord
from sqlite.engine import NlpEngine
def main()->None:
 engine=NlpEngine()
 try:
  try:GitHubCommitRecord(repository=123,sha="abc",author="red-team",committed_at="2026-10-08T00:00:00Z",message="malformed")
  except ValidationError:print("malformed commit: rejected")
  else:raise AssertionError("Malformed commit was accepted")
  commit=GitHubCommitRecord(repository="example/research",sha="a"*40,author="researcher",committed_at=datetime(2026,10,8,tzinfo=timezone.utc),message="Added MTL license integration for NY")
  document_id=engine.insert_github_commit(commit);hits=engine.search("MTL");assert any(row["id"]==document_id for row in hits)
  print("valid commit: inserted");print(f'FTS "MTL": {hits[0]["title"]}')
 finally:engine.close()
if __name__=="__main__":main()
