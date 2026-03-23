from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from config import JOB_MEDLEY_BASE_URL, SCRAPING_USER_AGENT, settings

HTTP_USER_AGENT = SCRAPING_USER_AGENT
from parser.salary_parser import parse_payment_method, parse_salary_min_max


@dataclass(frozen=True)
class JobMedleyJob:
    """Extracted fields per user spec: 施設名, 勤務地, 職種, 雇用形態, 給与, 支給方法, サービス形態."""

    facility_name: str  # 施設名
    prefecture: str  # 勤務地 都道府県
    city: str  # 勤務地 市区町村
    job_type: str  # 職種
    employment_type: str  # 雇用形態
    salary_min: int | None  # 給与 下限
    salary_max: int | None  # 給与 上限
    payment_method: str  # 支給方法（月給/時給/日給/年収）
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
        job_detail_concurrency: int = settings.job_detail_concurrency,
    ) -> None:
        self.headless = headless
        self.navigation_timeout_ms = navigation_timeout_ms
        self.request_timeout_ms = request_timeout_ms
        self.wait_until = wait_until
        self.throttle_sleep_s = throttle_sleep_s
        self.job_detail_concurrency = job_detail_concurrency

    def __enter__(self) -> "JobMedleyScraper":
        print("[ブラウザ] 起動中...", flush=True)
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=self.headless)
        print("[ブラウザ] 準備完了", flush=True)
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

    def _extract_total_count_from_search_page(self, page) -> int | None:
        """
        Extract 該当件数 X件 from search results page.
        Returns total matching job count, or None if not found.
        """
        # Try innerText first (rendered text); fall back to HTML
        try:
            text = page.evaluate("() => document.body?.innerText ?? ''")
        except Exception:
            text = page.content()
        m = re.search(r"該当件数\s*(\d+)\s*件", text) or re.search(r"該当件数(\d+)件", text)
        return int(m.group(1)) if m else None

    def _fetch_job_detail_http(self, job_url: str) -> str | None:
        """Fetch job detail HTML via HTTP (faster than Playwright)."""
        try:
            req = Request(job_url, headers={"User-Agent": HTTP_USER_AGENT})
            with urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception:
            return None

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

        # 施設名: "法人・施設名" or "事業所名" (ハローワーク求人)
        facility_name = ""
        for heading, use_link in [("法人・施設名", True), ("事業所名", False)]:
            for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
                if heading in tag.get_text(strip=True):
                    if use_link:
                        a = tag.find_next("a")
                        if a:
                            facility_name = a.get_text(strip=True)
                    else:
                        next_elem = tag.find_next_sibling()
                        if next_elem:
                            facility_name = next_elem.get_text(strip=True)
                    break
            if facility_name:
                break
        if not facility_name:
            m = re.search(r"^(.+?)の.+求人", page_title)
            if m:
                facility_name = m.group(1).strip()
        if not facility_name:
            facility_name = "Unknown"

        # 勤務地: parse from 住所 (e.g. 東京都中央区銀座5-12-6)
        prefecture, city = search_prefecture, search_city

        # 職種: 募集職種の該当内容（医師、介護職/ヘルパー、看護師/准看護師等）を取得
        # 「募集職種」セクションを最優先、取れなければタイトルから取得
        job_type = ""
        for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
            if tag.get_text(strip=True) != "募集職種":
                continue
            # 募集内容の「募集職種」直後の要素のテキスト（例: 看護師/准看護師）
            next_elem = tag.find_next_sibling()
            if next_elem and next_elem.name not in ("script", "style"):
                t = next_elem.get_text(strip=True)
                if t and t != "募集職種" and len(t) < 80:
                    job_type = t
                    break
            # 事業所情報の「募集職種」直後のリンク（例: [医師(正職員)]）
            if not job_type:
                next_a = tag.find_next("a", href=re.compile(r"/[a-z]+/\d+"))
                if next_a:
                    txt = next_a.get_text(strip=True)
                    if txt and "応募" not in txt and "電話" not in txt:
                        job_type = txt
                        break
            # 直後のテキストノードを探索
            if not job_type:
                for s in tag.find_all_next(string=True):
                    t = str(s).strip()
                    if t and t != "募集職種" and len(t) < 80 and "求人" not in t:
                        job_type = t
                        break
            if job_type:
                break
        if not job_type or job_type == "募集職種":
            m = re.search(r"の(.+?)求人", page_title)
            job_type = m.group(1).strip() if m and m.group(1).strip() != "募集職種" else "Unknown"

        # 雇用形態: 【正職員】 or 給与正職員
        employment_type = ""
        m = re.search(r"【(正職員|契約職員|パート・バイト|業務委託)】", text)
        if m:
            employment_type = m.group(1)
        else:
            m = re.search(r"給与\s*(正職員|契約職員|パート・バイト|業務委託)", text)
            employment_type = m.group(1) if m else "Unknown"

        # 給与（下限/上限）・支給方法
        salary_min, salary_max = parse_salary_min_max(text)
        salary_min = 0 if salary_min is None else salary_min
        salary_max = 0 if salary_max is None else salary_max
        payment_method = parse_payment_method(text)

        # サービス形態: "診療科目・サービス形態" or "施設・サービス形態" の複数値を取得（表示順を維持）
        service_type = ""
        skip_texts = {"応募", "会員登録", "ログイン", "電話", "キープ", "地図", "求人を見る"}
        link_types: list[str] = []  # 表示順を維持
        comma_text = ""  # 「整体院、整骨院・接骨院」形式
        for heading_text in ["診療科目・サービス形態"]:
            for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
                if heading_text not in tag.get_text(strip=True):
                    continue
                for elem in tag.find_all_next():
                    if elem.name in ("h1", "h2", "h3", "h4") and elem != tag:
                        break
                    if elem.name == "a":
                        txt = elem.get_text(strip=True)
                        if txt and len(txt) < 50 and not any(s in txt for s in skip_texts) and txt not in link_types:
                            link_types.append(txt)
                next_elem = tag.find_next_sibling()
                if next_elem:
                    raw = next_elem.get_text(strip=True)
                    if raw and "、" in raw and len(raw) < 100 and not any(s in raw for s in skip_texts):
                        comma_text = raw
                break
        if comma_text:
            # リンクテキストと連結している場合を除去（例: 代替医療・リラクゼーション整体院、整骨院・接骨院）
            for lt in link_types:
                if comma_text.startswith(lt):
                    comma_text = comma_text[len(lt) :].lstrip("、 ")
                    break
            service_type = comma_text
        elif link_types:
            service_type = "、".join(link_types)
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
            payment_method=payment_method,
            service_type=service_type,
            job_url=job_url,
        )

    def scrape_area(
        self, prefecture_id: int, city_id: int, prefecture: str, city: str
    ):
        """
        Scrape job listings for an area. Yields (page_no, jobs) for each search page
        so the caller can persist results immediately and avoid data loss.
        Uses 該当件数 and 全ページ from the search page to determine how many pages to fetch.
        """
        total_pages: int | None = None
        total_count: int | None = None
        max_page = 9999  # fallback when 該当件数 unavailable; break when no links
        page_no = 1

        while page_no <= max_page:
            page_jobs: list[dict[str, Any]] = []
            page = self._new_page()
            try:
                url = self._build_search_url(prefecture_id, city_id, page_no)
                self._goto(page, url)
                time.sleep(self.throttle_sleep_s)

                if page_no == 1:
                    # Wait for 該当件数 to appear (may load after DOM)
                    try:
                        page.wait_for_function(
                            "document.body?.innerText?.includes('該当件数')",
                            timeout=5000,
                        )
                    except Exception:
                        pass
                    total_count = self._extract_total_count_from_search_page(page)
                    if total_count is not None:
                        print(f"  該当件数: {total_count}件", flush=True)

                job_links = self._extract_job_links_from_list(page)
                if not job_links:
                    print(f"  検索ページ {page_no}: 求人なし（終了）", flush=True)
                    break

                if page_no == 1 and total_count is not None and job_links:
                    total_pages = (total_count + len(job_links) - 1) // len(job_links)
                    max_page = total_pages  # use actual total (no cap)
                    print(f"  全{total_pages}ページ", flush=True)
                    print(f"  検索ページ {page_no}/{total_pages}: {url}", flush=True)
                else:
                    page_label = f"{page_no}/{total_pages}" if total_pages else str(page_no)
                    print(f"  検索ページ {page_label}: {url}", flush=True)

                print(f"    → 求人リンク {len(job_links)}件取得", flush=True)

                def fetch_one(args: tuple[int, str]) -> tuple[int, dict[str, Any] | None]:
                    idx, url = args
                    html = self._fetch_job_detail_http(url)
                    if not html:
                        return idx, None
                    job = self._parse_job_detail(html, url, prefecture, city)
                    return idx, job.__dict__

                results: list[dict[str, Any] | None] = [None] * len(job_links)
                with ThreadPoolExecutor(max_workers=self.job_detail_concurrency) as ex:
                    futures = {ex.submit(fetch_one, (i, url)): i for i, url in enumerate(job_links)}
                    for future in as_completed(futures):
                        idx, job_dict = future.result()
                        results[idx] = job_dict
                        if job_dict:
                            name = (job_dict.get("facility_name") or "")[:25]
                            if len(job_dict.get("facility_name") or "") > 25:
                                name += "..."
                            jt = job_dict.get("job_type", "")
                            print(f"      [{idx + 1}/{len(job_links)}] {name} | {jt}", flush=True)

                page_jobs = [r for r in results if r is not None]
                yield page_no, page_jobs
            finally:
                page.close()
            page_no += 1

