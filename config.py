from __future__ import annotations


# Base settings shared across scrapers.
SCRAPING_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)


class Settings:
    # Playwright
    headless: bool = True
    navigation_timeout_ms: int = 45_000
    request_timeout_ms: int = 45_000
    wait_until: str = "domcontentloaded"

    # Rate limiting (basic)
    throttle_sleep_s: float = 1.0

    # Pagination (MVP: stop when no more job links)
    max_pages_per_city: int = 20

    # Deduplication
    # Prefer job_url (spec requirement); fall back to job_id if needed later.
    dedup_key: str = "job_url"

    # CSV
    csv_encoding: str = "utf-8"


settings = Settings()


JOB_MEDLEY_BASE_URL = "https://job-medley.com"

# Phase 1: only介護職/ヘルパー (hh). Add more categories later (la, ls, ...).
JOB_MEDLEY_CATEGORIES: list[str] = ["hh"]

