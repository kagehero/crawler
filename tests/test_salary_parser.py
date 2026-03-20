"""Tests for parser.salary_parser."""
import pytest

from parser.salary_parser import parse_salary_min_max


def test_monthly_range():
    assert parse_salary_min_max("月給 250,000円〜300,000円") == (250000, 300000)
    assert parse_salary_min_max("月給395,000円 〜 450,000円") == (395000, 450000)


def test_hourly_range():
    assert parse_salary_min_max("時給 1,200円〜1,500円") == (1200, 1500)


def test_monthly_single():
    assert parse_salary_min_max("月給171,500円") == (171500, 171500)
    assert parse_salary_min_max("月給300,000円") == (300000, 300000)


def test_hourly_single():
    assert parse_salary_min_max("時給1,200円") == (1200, 1200)


def test_empty():
    assert parse_salary_min_max("") == (None, None)
    assert parse_salary_min_max("給与記載なし") == (None, None)
