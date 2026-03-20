from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from config import settings
from exporter.csv_exporter import export_jobs_to_csv
from scraper.job_medley import JobMedleyScraper
from utils.dedup import deduplicate_jobs


def load_areas_from_site_url_file(path: str) -> list[tuple[str, str, int, int]]:
    """
    Load (prefecture, city, prefecture_id, city_id) from TSV:
      prefecture  city  url
    """
    df = pd.read_csv(path, sep="\t", header=None, names=["prefecture", "city", "url"])
    df = df.dropna(subset=["prefecture", "city", "url"])
    areas = []
    for _, row in df.iterrows():
        pref = str(row["prefecture"]).strip()
        city = str(row["city"]).strip()
        url = str(row["url"]).strip()
        m = re.search(r"prefecture_id=(\d+)", url)
        m2 = re.search(r"city_id=(\d+)", url)
        if m and m2:
            areas.append((pref, city, int(m.group(1)), int(m2.group(1))))
    return areas


def load_areas_from_excel(path: str) -> list[tuple[str, str, int, int]]:
    """Load from Excel (prefecture, city) and resolve city_id via API."""
    df = pd.read_excel(path)
    pref_col = "都道府県" if "都道府県" in df.columns else "prefecture"
    city_col = "※市区町村" if "※市区町村" in df.columns else "city"
    pairs = df[[pref_col, city_col]].drop_duplicates().dropna()
    prefecture_id_map = {
        "北海道": 1, "青森県": 2, "岩手県": 3, "宮城県": 4, "秋田県": 5, "山形県": 6,
        "福島県": 7, "茨城県": 8, "栃木県": 9, "群馬県": 10, "埼玉県": 11, "千葉県": 12,
        "東京都": 13, "神奈川県": 14, "新潟県": 15, "富山県": 16, "石川県": 17, "福井県": 18,
        "山梨県": 19, "長野県": 20, "岐阜県": 21, "静岡県": 22, "愛知県": 23, "三重県": 24,
        "滋賀県": 25, "京都府": 26, "大阪府": 27, "兵庫県": 28, "奈良県": 29, "和歌山県": 30,
        "鳥取県": 31, "島根県": 32, "岡山県": 33, "広島県": 34, "山口県": 35, "徳島県": 36,
        "香川県": 37, "愛媛県": 38, "高知県": 39, "福岡県": 40, "佐賀県": 41, "長崎県": 42,
        "熊本県": 43, "大分県": 44, "宮崎県": 45, "鹿児島県": 46, "沖縄県": 47,
    }
    import json
    from urllib.request import Request, urlopen
    areas = []
    cache = {}
    for _, row in pairs.iterrows():
        pref = str(row[pref_col]).strip()
        city = str(row[city_col]).strip()
        if pref not in prefecture_id_map:
            continue
        pid = prefecture_id_map[pref]
        if pid not in cache:
            url = f"https://job-medley.com/api/members/v1/job_offers/city_search_list?prefectureId={pid}&pageType=1"
            req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
            data = json.loads(urlopen(req, timeout=30).read().decode("utf-8"))
            city_map = {}
            for g in data.get("designatedCityGroups", []):
                for c in g.get("cities", []):
                    city_map[str(c.get("name", "")).strip()] = int(c.get("id"))
            cache[pid] = city_map
        city_map = cache[pid]
        cid = city_map.get(city) or city_map.get(city.replace(" ", ""))
        if cid is None:
            for k, v in city_map.items():
                if city in k or k in city:
                    cid = v
                    break
        if cid is not None:
            areas.append((pref, city, pid, cid))
    return areas


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="site URL")
    parser.add_argument("--output", default="data/output.csv")
    parser.add_argument("--max-areas", type=int, default=None)
    parser.add_argument("--excel", action="store_true", help="Use Excel input (resolve city_id via API)")
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    if args.excel:
        areas = load_areas_from_excel(str(input_path))
    else:
        areas = load_areas_from_site_url_file(str(input_path))

    if args.max_areas is not None:
        areas = areas[: args.max_areas]

    scraped_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    scraper = JobMedleyScraper(
        headless=settings.headless,
        navigation_timeout_ms=settings.navigation_timeout_ms,
        request_timeout_ms=settings.request_timeout_ms,
        wait_until=settings.wait_until,
        throttle_sleep_s=settings.throttle_sleep_s,
        max_pages_per_area=settings.max_pages_per_city,
    )

    all_jobs: list[dict] = []
    with scraper:
        for pref, city, pref_id, city_id in areas:
            sys.stdout.write(f"Scraping: {pref} / {city}\n")
            sys.stdout.flush()
            jobs = scraper.scrape_area(
                prefecture_id=pref_id,
                city_id=city_id,
                prefecture=pref,
                city=city,
            )
            for j in jobs:
                j["scraped_at"] = scraped_at
                m = re.search(r"job-medley\.com/[a-z]+/(?:hw/)?(\d+)", j.get("job_url", ""))
                j["job_id"] = m.group(1) if m else ""
            all_jobs.extend(jobs)

    all_jobs = deduplicate_jobs(all_jobs, dedup_key=settings.dedup_key)
    export_jobs_to_csv(all_jobs, args.output, encoding=settings.csv_encoding)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

