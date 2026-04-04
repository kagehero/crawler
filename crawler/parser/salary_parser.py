from __future__ import annotations

import re
from typing import Optional


_YEN_RE = re.compile(r"([0-9][0-9,]*)\\s*円")

# 支給方法の候補（出現順に検索）
PAYMENT_METHOD_PATTERN = re.compile(r"月給|時給|日給|年収")


def _to_int_money(value: str) -> int:
    return int(value.replace(",", "").strip())


def parse_payment_method(text: str) -> str:
    """
    Extract 支給方法 (payment method) from Japanese job descriptions.
    Returns first match of 月給, 時給, 日給, 年収; else empty string.
    """
    if not text:
        return ""
    m = PAYMENT_METHOD_PATTERN.search(text)
    return m.group(0) if m else ""


def parse_salary_min_max(text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract salary range in JPY from Japanese job descriptions.

    Formats:
      - ① 〇円～ (single, no upper) → min=value, max=0
      - ② 〇円 (single) → min=value, max=0
      - ③ 〇円～〇円 (range) → min=low, max=high

    Examples:
      - "月給 250,000円〜300,000円" -> (250000, 300000)
      - "時給 1,200円〜1,500円"   -> (1200, 1500)
      - "日給 33,000円〜40,000円" -> (33000, 40000)
      - "月給171,500円"         -> (171500, 0)
      - "月給 238,500円〜"      -> (238500, 0)
      - "日給 33,000円〜"       -> (33000, 0)
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

    # 1) Range: 〇円～〇円
    m = re.search(r"月給\s*([0-9][0-9,]*)\s*円\s*~\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), _to_int_money(m.group(2))

    m = re.search(r"時給\s*([0-9][0-9,]*)\s*円\s*~\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), _to_int_money(m.group(2))

    m = re.search(r"日給\s*([0-9][0-9,]*)\s*円\s*~\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), _to_int_money(m.group(2))

    # 2) Single: 〇円 or 〇円～ (①②とも min=value, max=0)
    m = re.search(r"月給\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), 0

    m = re.search(r"時給\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), 0

    m = re.search(r"日給\s*([0-9][0-9,]*)\s*円", normalized)
    if m:
        return _to_int_money(m.group(1)), 0

    return None, None

