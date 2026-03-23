from __future__ import annotations

import csv
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
    "payment_method",  # 支給方法（月給/時給/日給/年収）
    "service_type",
    "job_url",
    "job_id",
    "acquisition_date",  # データ取得日
]


def export_jobs_to_csv(jobs: list[dict[str, Any]], output_path: str, encoding: str = "utf-8-sig") -> None:
    if not jobs:
        # Still create a file with headers.
        df = pd.DataFrame(columns=OUTPUT_COLUMNS)
    else:
        df = pd.DataFrame(jobs)

    # Ensure required columns exist (fill missing with empty strings).
    for col in OUTPUT_COLUMNS:
        if col not in df.columns:
            df[col] = ""

    # Keep required columns only.
    df = df[OUTPUT_COLUMNS]

    # utf-8-sig: UTF-8 with BOM so Excel opens Japanese correctly
    df.to_csv(output_path, index=False, encoding=encoding, quoting=csv.QUOTE_MINIMAL)

