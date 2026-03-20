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
    "求人票URL",
    # Optional recommended fields
    "job_id",
    "scraped_at",
]


def export_jobs_to_csv(jobs: list[dict[str, Any]], output_path: str, encoding: str = "utf-8-sig") -> None:
    if not jobs:
        # Still create a file with headers.
        df = pd.DataFrame(columns=[c for c in OUTPUT_COLUMNS if c not in ("job_id", "scraped_at")])
    else:
        df = pd.DataFrame(jobs)

    # Ensure required columns exist (fill missing with empty strings).
    for col in OUTPUT_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    # 求人票URL = job_url (same value)
    if "求人票URL" in df.columns and "job_url" in df.columns:
        df["求人票URL"] = df["job_url"].fillna("")

    # Keep required + recommended columns only.
    df = df[OUTPUT_COLUMNS]

    # utf-8-sig: UTF-8 with BOM so Excel opens Japanese correctly
    df.to_csv(output_path, index=False, encoding=encoding, quoting=csv.QUOTE_MINIMAL)

