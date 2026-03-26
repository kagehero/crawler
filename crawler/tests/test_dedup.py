"""Tests for utils.dedup."""
import pytest

from utils.dedup import deduplicate_jobs


def test_dedup_by_job_url():
    jobs = [
        {"job_url": "https://job-medley.com/ans/1/", "facility": "A"},
        {"job_url": "https://job-medley.com/ans/2/", "facility": "B"},
        {"job_url": "https://job-medley.com/ans/1/", "facility": "A again"},
    ]
    result = deduplicate_jobs(jobs, dedup_key="job_url")
    assert len(result) == 2
    assert result[0]["facility"] == "A"
    assert result[1]["facility"] == "B"


def test_dedup_empty():
    assert deduplicate_jobs([]) == []


def test_dedup_all_unique():
    jobs = [{"job_url": f"https://example.com/{i}/"} for i in range(3)]
    assert len(deduplicate_jobs(jobs)) == 3
