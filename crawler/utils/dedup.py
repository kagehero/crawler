from __future__ import annotations

from typing import Any


def deduplicate_jobs(jobs: list[dict[str, Any]], dedup_key: str = "job_url") -> list[dict[str, Any]]:
    """
    De-duplicate job records by `dedup_key` (prefers job_url per spec).
    """
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for job in jobs:
        key = str(job.get(dedup_key) or "")
        if not key:
            # If key is missing, keep the record (but it won't dedup).
            out.append(job)
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(job)
    return out

