from __future__ import annotations

import csv
from datetime import datetime
from typing import Any

import pandas as pd


OUTPUT_COLUMNS = [
    "facility_name",
    "prefecture",
    "city",
    "job_type",
    "employment_type",
    "salary_min",
    "salary_max",
    "service_type",
    "job_url",
    # Optional recommended fields
    "job_id",
    "scraped_at",
]


def export_jobs_to_csv(jobs: list[dict[str, Any]], output_path: str, encoding: str = "utf-8") -> None:
    if not jobs:
        # Still create a file with headers.
        df = pd.DataFrame(columns=[c for c in OUTPUT_COLUMNS if c not in ("job_id", "scraped_at")])
    else:
        df = pd.DataFrame(jobs)

    # Ensure required columns exist (fill missing with empty strings).
    for col in OUTPUT_COLUMNS:
        if col not in df.columns:
            df[col] = ""

    # Keep required + recommended columns only.
    df = df[OUTPUT_COLUMNS]

    # Enforce UTF-8 encoding for portability.
    df.to_csv(output_path, index=False, encoding=encoding, quoting=csv.QUOTE_MINIMAL)

