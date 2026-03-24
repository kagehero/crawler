"""
WellMe Job (kaigojob.com / ウェルミージョブ) scraper.
Extracts same fields as job-medley: facility_name, prefecture, city, job_type,
employment_type, salary_min, salary_max, service_type, job_url.
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from config import settings
from parser.salary_parser import parse_payment_method, parse_salary_min_max

WELLME_BASE = "https://www.kaigojob.com"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"


def _fetch(url: str) -> str | None:
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8")
    except Exception:
        return None


def _add_page_to_url(url: str, page: int) -> str:
    """Add or update page parameter in URL."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    qs["page"] = [str(page)]
    new_query = urlencode(qs, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _extract_job_links(html: str) -> list[str]:
    """Extract job detail URLs from search results."""
    soup = BeautifulSoup(html, "lxml")
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "/job-postings-" in href or "/care-worker/job-postings-" in href:
            full = urljoin(WELLME_BASE, href) if href.startswith("/") else href
            if "kaigojob.com" in full and "job-postings-" in full:
                links.append(full.split("?")[0])
    return sorted(set(links))


def _parse_job_detail(html: str, job_url: str, search_prefecture: str, search_city: str) -> dict[str, Any]:
    """Parse job detail page into dict matching OUTPUT_COLUMNS."""
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", strip=True)

    facility_name = ""
    for tag in soup.find_all(["dt", "th"]):
        t = tag.get_text(strip=True)
        if "事業所名" in t:
            next_ = tag.find_next_sibling() or tag.find_next()
            if next_:
                facility_name = next_.get_text(strip=True)
            break
    if not facility_name:
        for tag in soup.find_all(["dt", "th"]):
            t = tag.get_text(strip=True)
            if "法人名" in t:
                next_ = tag.find_next_sibling() or tag.find_next()
                if next_:
                    facility_name = next_.get_text(strip=True)
                break
    if not facility_name and soup.title:
        m = re.search(r"^(.+?)の介護職員", soup.title.get_text())
        if m:
            facility_name = m.group(1).strip()
    if not facility_name:
        facility_name = "Unknown"

    prefecture, city = search_prefecture, search_city
    m_addr = re.search(r"住所\s+([^\s]+[都道府県][^\s]*[^\s]*)", text)
    if m_addr:
        a = m_addr.group(1).strip()
        pm = re.match(r"^(.+?[都道府県])", a)
        if pm:
            prefecture = pm.group(1).strip()
        cm = re.search(r"[都道府県]([^\s]+?[区市町村])", a)
        if cm:
            city = cm.group(1).strip()
    if not prefecture and "〒" in text:
        m = re.search(r"〒\d+\s+([^\s]+[都道府県])([^\s]+)", text)
        if m:
            prefecture = m.group(1).strip()
            city = m.group(2).strip()

    # 都道府県：郵便番号付き（〒104-0033東京都）の場合は都道府県名のみに整える
    if prefecture:
        prefecture = re.sub(r"^〒[\d\-]+\s*", "", prefecture).strip()

    job_type = "介護職員・ヘルパー"
    for tag in soup.find_all(["dt", "th"]):
        if tag.get_text(strip=True) == "職種名":
            next_ = tag.find_next_sibling() or tag.find_next()
            if next_:
                job_type = next_.get_text(strip=True)
            break

    employment_type = ""
    for tag in soup.find_all(["dt", "th"]):
        if tag.get_text(strip=True) == "雇用形態":
            next_ = tag.find_next_sibling() or tag.find_next()
            if next_:
                employment_type = next_.get_text(strip=True)
            break
    if not employment_type:
        for kw in ["契約社員", "正社員", "パート・アルバイト", "業務委託"]:
            if kw in text:
                employment_type = kw
                break
    if not employment_type:
        employment_type = "Unknown"

    salary_min, salary_max = parse_salary_min_max(text)
    salary_min = salary_min or 0
    salary_max = salary_max or 0
    payment_method = parse_payment_method(text)

    service_type = ""
    for tag in soup.find_all(["dt", "th"]):
        t = tag.get_text(strip=True)
        if "サービス種別" in t:
            next_ = tag.find_next_sibling() or tag.find_next()
            if next_:
                service_type = next_.get_text(strip=True)
            break
    if not service_type:
        m_svc = re.search(r"サービス種別\s+(\S+)", text)
        if m_svc:
            service_type = m_svc.group(1).strip()
    if not service_type:
        for kw in ["有料老人ホーム", "デイサービス", "訪問介護", "グループホーム", "特別養護老人ホーム", "介護医療院", "サービス付き高齢者向け住宅"]:
            if kw in text:
                service_type = kw
                break

    return {
        "facility_name": facility_name,
        "prefecture": prefecture,
        "city": city,
        "job_category": "介護職員・ヘルパー",  # care-worker 固定
        "job_type": job_type,
        "employment_type": employment_type,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "payment_method": payment_method,
        "service_type": service_type,
        "job_url": job_url,
    }


def scrape_wellme_area(
    search_url: str,
    prefecture: str,
    city: str,
    concurrency: int = settings.job_detail_concurrency,
) -> list[dict[str, Any]]:
    """
    Scrape WellMe Job (kaigojob.com) for a given search URL.
    Yields (page_no, jobs) for each search page.
    """
    all_jobs: list[dict[str, Any]] = []
    page_no = 1
    seen_urls: set[str] = set()

    while True:
        page_url = _add_page_to_url(search_url, page_no)
        html = _fetch(page_url)
        if not html:
            break

        job_links = _extract_job_links(html)
        if not job_links:
            break

        results: list[dict[str, Any] | None] = [None] * len(job_links)

        def fetch_one(args: tuple[int, str]) -> tuple[int, dict[str, Any] | None]:
            idx, url = args
            if url in seen_urls:
                return idx, None
            h = _fetch(url)
            if not h:
                return idx, None
            return idx, _parse_job_detail(h, url, prefecture, city)

        with ThreadPoolExecutor(max_workers=concurrency) as ex:
            futures = {ex.submit(fetch_one, (i, url)): i for i, url in enumerate(job_links)}
            for future in as_completed(futures):
                idx, job_dict = future.result()
                results[idx] = job_dict
                if job_dict:
                    seen_urls.add(job_dict["job_url"])
                    name = (job_dict.get("facility_name") or "")[:25]
                    if len(job_dict.get("facility_name") or "") > 25:
                        name += "..."
                    jt = job_dict.get("job_type", "")
                    print(f"      [{idx + 1}/{len(job_links)}] {name} | {jt}", flush=True)

        page_jobs = [r for r in results if r is not None]
        all_jobs.extend(page_jobs)
        yield page_no, page_jobs

        if len(job_links) < 20:
            break
        page_no += 1
