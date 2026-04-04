from __future__ import annotations


# Base settings shared across scrapers.
SCRAPING_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)


class Settings:
    # 互換用（旧 Playwright 設定）。現行 job_medley は HTTP のみ。
    headless: bool = True
    navigation_timeout_ms: int = 120_000
    request_timeout_ms: int = 60_000
    wait_until: str = "commit"

    # ジョブメドレー検索ページ間の待ち秒（0 で無効）
    throttle_sleep_s: float = 0.3
    job_detail_concurrency: int = 5  # 求人詳細の並列取得数

    # Deduplication
    # Prefer job_url (spec requirement); fall back to job_id if needed later.
    dedup_key: str = "job_url"

    # CSV: utf-8-sig adds BOM so Excel recognizes UTF-8 and displays Japanese correctly
    csv_encoding: str = "utf-8-sig"


settings = Settings()


JOB_MEDLEY_BASE_URL = "https://job-medley.com"

# Phase 1: only介護職/ヘルパー (hh). Add more categories later (la, ls, ...).
JOB_MEDLEY_CATEGORIES: list[str] = ["hh"]

