#!/usr/bin/env python3
"""
Generate site_url_jobmedley and site_url_wellme from Excel (都道府県, 市区町村).
Uses Job Medley API to resolve city_id; WellMe uses c-{city_id} (JIS code).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

PREFTURE_ID_MAP = {
    "北海道": 1, "青森県": 2, "岩手県": 3, "宮城県": 4, "秋田県": 5, "山形県": 6,
    "福島県": 7, "茨城県": 8, "栃木県": 9, "群馬県": 10, "埼玉県": 11, "千葉県": 12,
    "東京都": 13, "神奈川県": 14, "新潟県": 15, "富山県": 16, "石川県": 17, "福井県": 18,
    "山梨県": 19, "長野県": 20, "岐阜県": 21, "静岡県": 22, "愛知県": 23, "三重県": 24,
    "滋賀県": 25, "京都府": 26, "大阪府": 27, "兵庫県": 28, "奈良県": 29, "和歌山県": 30,
    "鳥取県": 31, "島根県": 32, "岡山県": 33, "広島県": 34, "山口県": 35, "徳島県": 36,
    "香川県": 37, "愛媛県": 38, "高知県": 39, "福岡県": 40, "佐賀県": 41, "長崎県": 42,
    "熊本県": 43, "大分県": 44, "宮崎県": 45, "鹿児島県": 46, "沖縄県": 47,
}


def load_pairs_from_excel(path: str) -> list[tuple[str, str]]:
    df = pd.read_excel(path)
    pref_col = "都道府県" if "都道府県" in df.columns else "prefecture"
    city_col = "※市区町村" if "※市区町村" in df.columns else "city"
    pairs = df[[pref_col, city_col]].dropna(how="any").drop_duplicates()
    pairs = pairs[pairs[pref_col].astype(str).str.strip() != ""]
    pairs = pairs[pairs[city_col].astype(str).str.strip() != ""]
    pairs = pairs.apply(lambda x: x.astype(str).str.strip())
    pairs = pairs.drop_duplicates()
    return [(str(r[pref_col]), str(r[city_col])) for _, r in pairs.iterrows()]


def resolve_jobmedley_areas(pairs: list[tuple[str, str]]) -> list[tuple[str, str, str]]:
    """Resolve (pref, city) -> (pref, city, url) using Job Medley API."""
    cache: dict[int, dict[str, int]] = {}
    results: list[tuple[str, str, str]] = []
    for pref, city in pairs:
        if pref not in PREFTURE_ID_MAP:
            print(f"  [skip] {pref} {city}: unknown prefecture", file=sys.stderr)
            continue
        pid = PREFTURE_ID_MAP[pref]
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
            url = f"https://job-medley.com/search/?prefecture_id={pid}&city_id={cid}&page=1"
            results.append((pref, city, url))
        else:
            print(f"  [skip] {pref} {city}: city not found in Job Medley", file=sys.stderr)
    return results


def resolve_wellme_areas(jobmedley_results: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    """Build WellMe URLs from Job Medley city_id (JIS code)."""
    results: list[tuple[str, str, str]] = []
    for pref, city, jm_url in jobmedley_results:
        import re
        m = re.search(r"city_id=(\d+)", jm_url)
        if m:
            city_code = m.group(1)
            url = f"https://www.kaigojob.com/care-worker/c-{city_code}?sorter_strategy=newer_first"
            results.append((pref, city, url))
        else:
            print(f"  [skip] {pref} {city}: no city_id for WellMe", file=sys.stderr)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate site URL files from Excel")
    parser.add_argument("excel", default="株式会社レイクス21（拠点一覧）.xlsx", nargs="?")
    parser.add_argument("--jobmedley", default="site_url_jobmedley_raks", help="Output path for Job Medley URLs")
    parser.add_argument("--wellme", default="site_url_wellme_raks", help="Output path for WellMe URLs")
    args = parser.parse_args()

    path = Path(args.excel)
    if not path.exists():
        print(f"Error: {path} not found", file=sys.stderr)
        return 1

    pairs = load_pairs_from_excel(str(path))
    print(f"Loaded {len(pairs)} unique (prefecture, city) from {path}", flush=True)

    jm_areas = resolve_jobmedley_areas(pairs)
    print(f"Resolved {len(jm_areas)} Job Medley URLs", flush=True)

    wm_areas = resolve_wellme_areas(jm_areas)
    print(f"Resolved {len(wm_areas)} WellMe URLs", flush=True)

    # Write TSV files
    with open(args.jobmedley, "w", encoding="utf-8") as f:
        for pref, city, url in jm_areas:
            f.write(f"{pref}\t{city}\t{url}\n")
    print(f"Wrote {args.jobmedley}", flush=True)

    with open(args.wellme, "w", encoding="utf-8") as f:
        for pref, city, url in wm_areas:
            f.write(f"{pref}\t{city}\t{url}\n")
    print(f"Wrote {args.wellme}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
