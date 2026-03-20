from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from config import JOB_MEDLEY_BASE_URL, SCRAPING_USER_AGENT, settings
from parser.salary_parser import parse_salary_min_max


@dataclass(frozen=True)
class JobMedleyJob:
    """Extracted fields per user spec: 施設名, 勤務地, 職種, 雇用形態, 給与, サービス形態."""

    facility_name: str  # 施設名
    prefecture: str  # 勤務地 都道府県
    city: str  # 勤務地 市区町村
    job_type: str  # 職種
    employment_type: str  # 雇用形態
    salary_min: int | None  # 給与 下限
    salary_max: int | None  # 給与 上限
    service_type: str  # サービス形態
    job_url: str


class JobMedleyScraper:
    """
    Scrape job-medley.com using:
      /search/?prefecture_id={pref_id}&city_id={city_id}&page={page}
    Extract: 施設名, 勤務地(都道府県/市区町村), 職種, 雇用形態, 給与(下限/上限), サービス形態.
    """

    def __init__(
        self,
        headless: bool = True,
        navigation_timeout_ms: int = settings.navigation_timeout_ms,
        request_timeout_ms: int = settings.request_timeout_ms,
        wait_until: str = settings.wait_until,
        throttle_sleep_s: float = settings.throttle_sleep_s,
        max_pages_per_area: int = settings.max_pages_per_city,
    ) -> None:
        self.headless = headless
        self.navigation_timeout_ms = navigation_timeout_ms
        self.request_timeout_ms = request_timeout_ms
        self.wait_until = wait_until
        self.throttle_sleep_s = throttle_sleep_s
        self.max_pages_per_area = max_pages_per_area

    def __enter__(self) -> "JobMedleyScraper":
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=self.headless)
        self._context = self._browser.new_context(
            user_agent=SCRAPING_USER_AGENT,
            locale="ja-JP",
        )
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        try:
            self._context.close()
        finally:
            self._browser.close()
            self._pw.stop()

    def _new_page(self):
        return self._context.new_page()

    @retry(
        retry=retry_if_exception_type((Exception,)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=10),
        reraise=True,
    )
    def _goto(self, page, url: str) -> None:
        page.goto(url, timeout=self.navigation_timeout_ms, wait_until=self.wait_until)

    def _build_search_url(self, prefecture_id: int, city_id: int, page_no: int) -> str:
        return f"{JOB_MEDLEY_BASE_URL}/search/?prefecture_id={prefecture_id}&city_id={city_id}&page={page_no}"

    def _extract_job_links_from_list(self, page) -> list[str]:
        """
        Extract job detail URLs from /search/ results. Links go to /dr/, /apo/, /hh/, etc.
        """
        anchors = page.locator("a[href]").element_handles()
        links: set[str] = set()
        for a in anchors:
            href = a.get_attribute("href") or ""
            if href.startswith("/"):
                href_full = JOB_MEDLEY_BASE_URL + href
            elif href.startswith("http") and "job-medley.com" in href:
                href_full = href
            else:
                continue
            href_no_q = href_full.split("?", 1)[0].split("#", 1)[0]
            # job-medley.com/{category}/{id}/ or /{category}/hw/{id}/
            m = re.search(r"job-medley\.com/([a-z]+)/(?:hw/)?(\d+)/?$", href_no_q)
            if m:
                links.add(href_no_q)
        return sorted(links)

    def _parse_job_detail(
        self, html: str, job_url: str, search_prefecture: str, search_city: str
    ) -> JobMedleyJob:
        soup = BeautifulSoup(html, "lxml")
        page_title = soup.title.get_text(strip=True) if soup.title else ""
        text = soup.get_text(" ", strip=True)

        # 施設名: "法人・施設名" section
        facility_name = ""
        for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
            if "法人・施設名" in tag.get_text(strip=True):
                a = tag.find_next("a")
                if a:
                    facility_name = a.get_text(strip=True)
                break
        if not facility_name:
            facility_name = "Unknown"

        # 勤務地: parse from 住所 (e.g. 東京都中央区銀座5-12-6)
        prefecture, city = search_prefecture, search_city
        addr_match = re.search(r"住所\s*([^\s]+)", text) or re.search(
            r"([^\s]+[都道府県][^\s]*[市区町村][^\s]*)", text
        )
        if addr_match:
            addr = addr_match.group(1).strip()
            pref_m = re.match(r"^(.+?[都道府県])", addr)
            if pref_m:
                prefecture = pref_m.group(1).strip()
            city_m = re.search(r"[都道府県]([^\s]+?[市区町村])", addr)
            if city_m:
                city = city_m.group(1).strip()

        # 職種: "募集職種" or title "...の医師求人" / "...の介護職/ヘルパー求人"
        job_type = ""
        for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
            if "募集職種" in tag.get_text(strip=True):
                n = tag.find_next(string=True)
                if n:
                    job_type = str(n).strip()
                break
        if not job_type:
            m = re.search(r"の(.+?)求人", page_title)
            if m:
                job_type = m.group(1).strip()
        if not job_type:
            job_type = "Unknown"

        # 雇用形態: 【正職員】 or 給与正職員
        employment_type = ""
        m = re.search(r"【(正職員|契約職員|パート・バイト|業務委託)】", text)
        if m:
            employment_type = m.group(1)
        else:
            m = re.search(r"給与\s*(正職員|契約職員|パート・バイト|業務委託)", text)
            employment_type = m.group(1) if m else "Unknown"

        # 給与（下限/上限）
        salary_min, salary_max = parse_salary_min_max(text)
        salary_min = 0 if salary_min is None else salary_min
        salary_max = 0 if salary_max is None else salary_max

        # サービス形態: "診療科目・サービス形態" or "施設・サービス形態"
        service_type = ""
        for heading_text in ["診療科目・サービス形態", "施設・サービス形態"]:
            for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
                if heading_text in tag.get_text(strip=True):
                    a = tag.find_next("a")
                    if a:
                        service_type = a.get_text(strip=True)
                    break
            if service_type:
                break
        if not service_type:
            a = soup.find(
                "a",
                string=re.compile(
                    r"(通所介護|訪問介護|グループホーム|特別養護老人ホーム|美容外科|精神科|一般内科)"
                ),
            )
            if a:
                service_type = a.get_text(strip=True)

        return JobMedleyJob(
            facility_name=facility_name,
            prefecture=prefecture,
            city=city,
            job_type=job_type,
            employment_type=employment_type,
            salary_min=salary_min,
            salary_max=salary_max,
            service_type=service_type,
            job_url=job_url,
        )

    def scrape_area(
        self, prefecture_id: int, city_id: int, prefecture: str, city: str
    ) -> list[dict[str, Any]]:
        jobs: list[dict[str, Any]] = []

        for page_no in range(1, self.max_pages_per_area + 1):
            page = self._new_page()
            try:
                url = self._build_search_url(prefecture_id, city_id, page_no)
                self._goto(page, url)
                time.sleep(self.throttle_sleep_s)

                job_links = self._extract_job_links_from_list(page)
                if not job_links:
                    break

                for job_url in job_links:
                    detail_page = self._new_page()
                    try:
                        self._goto(detail_page, job_url)
                        time.sleep(self.throttle_sleep_s)
                        html = detail_page.content()
                        job = self._parse_job_detail(
                            html=html,
                            job_url=job_url,
                            search_prefecture=prefecture,
                            search_city=city,
                        )
                        jobs.append(job.__dict__)
                    finally:
                        detail_page.close()
            finally:
                page.close()
        return jobs

