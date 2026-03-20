from __future__ import annotations

import re
from typing import Optional


_YEN_RE = re.compile(r"([0-9][0-9,]*)\\s*円")


def _to_int_money(value: str) -> int:
    return int(value.replace(",", "").strip())


def parse_salary_min_max(text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract salary range in JPY from Japanese job descriptions.

    Examples:
      - "月給 250,000円〜300,000円" -> (250000, 300000)
      - "時給 1,200円〜1,500円"   -> (1200, 1500)
      - "月給171,500円"         -> (171500, 171500)
    """
    if not text:
        return None, None

    # Normalize some common dash characters.
    normalized = (
        text.replace("〜", "~")
        .replace("～", "~")
        .replace("-", "~")
        .replace("—", "~")
    )

    # 1) Monthly salary range.
    m = re.search(r"月給\s*([0-9][0-9,]*)\s*円\s*~\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), _to_int_money(m.group(2))

    # 2) Hourly wage range.
    m = re.search(r"時給\s*([0-9][0-9,]*)\s*円\s*~\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), _to_int_money(m.group(2))

    # 3) Monthly salary single.
    m = re.search(r"月給\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        v = _to_int_money(m.group(1))
        return v, v

    # 4) Hourly wage single.
    m = re.search(r"時給\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        v = _to_int_money(m.group(1))
        return v, v

    return None, None

