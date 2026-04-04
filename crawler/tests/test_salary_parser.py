"""Tests for parser.salary_parser."""
import pytest

from parser.salary_parser import parse_payment_method, parse_salary_min_max


def test_monthly_range():
    assert parse_salary_min_max("月給 250,000円〜300,000円") == (250000, 300000)
    assert parse_salary_min_max("月給395,000円 〜 450,000円") == (395000, 450000)


def test_hourly_range():
    assert parse_salary_min_max("時給 1,200円〜1,500円") == (1200, 1500)


def test_daily_range():
    assert parse_salary_min_max("日給 33,000円〜40,000円") == (33000, 40000)
    assert parse_salary_min_max("日給 33,000 円〜 40,000 円") == (33000, 40000)


def test_monthly_single():
    """② 〇円 and ① 〇円～ → max=0"""
    assert parse_salary_min_max("月給171,500円") == (171500, 0)
    assert parse_salary_min_max("月給300,000円") == (300000, 0)
    assert parse_salary_min_max("月給 238,500円〜") == (238500, 0)


def test_hourly_single():
    assert parse_salary_min_max("時給1,200円") == (1200, 0)


def test_daily_single():
    assert parse_salary_min_max("日給 33,000円〜") == (33000, 0)
    assert parse_salary_min_max("日給 33,000 円〜") == (33000, 0)
    assert parse_salary_min_max("日給33,000円") == (33000, 0)


def test_empty():
    assert parse_salary_min_max("") == (None, None)
    assert parse_salary_min_max("給与記載なし") == (None, None)


def test_payment_method():
    assert parse_payment_method("月給 238,500円〜") == "月給"
    assert parse_payment_method("時給1,400円〜1,600円") == "時給"
    assert parse_payment_method("日給 33,000円〜") == "日給"
    assert parse_payment_method("給与記載なし") == ""
