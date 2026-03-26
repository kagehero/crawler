"""Tests for scraper.job_medley."""
import pytest

from scraper.job_medley import JobMedleyScraper


SAMPLE_HTML = """
<!DOCTYPE html>
<html>
<head><title>〇〇病院の看護師/准看護師求人(正職員) | ジョブメドレー</title></head>
<body>
<h3>法人・施設名</h3>
<a href="/facility/123">テスト病院</a>

<h3>募集職種</h3>
<div>看護師/准看護師</div>

<p>住所 京都府長岡京市天神1丁目19番5号</p>
<p>【正職員】 月給395,000円〜450,000円</p>

<h3>診療科目・サービス形態</h3>
<a href="/ans/feature1/">訪問看護ステーション</a>
</body>
</html>
"""


@pytest.fixture
def scraper():
    return JobMedleyScraper(headless=True)


def test_parse_job_detail_job_type_from_title(scraper):
    """職種はタイトル「の〇〇求人」から取得される"""
    job = scraper._parse_job_detail(
        SAMPLE_HTML,
        "https://job-medley.com/ans/1150441/",
        "京都府",
        "長岡京市",
    )
    assert job.job_type == "看護師/准看護師"


def test_parse_job_detail_facility_name(scraper):
    job = scraper._parse_job_detail(SAMPLE_HTML, "https://job-medley.com/ans/1/", "京都府", "長岡京市")
    assert job.facility_name == "テスト病院"


def test_parse_job_detail_address(scraper):
    job = scraper._parse_job_detail(SAMPLE_HTML, "https://job-medley.com/ans/1/", "京都府", "長岡京市")
    assert job.prefecture == "京都府"
    assert "長岡京市" in job.city


def test_parse_job_detail_employment_type(scraper):
    job = scraper._parse_job_detail(SAMPLE_HTML, "https://job-medley.com/ans/1/", "京都府", "長岡京市")
    assert job.employment_type == "正職員"


def test_parse_job_detail_salary(scraper):
    job = scraper._parse_job_detail(SAMPLE_HTML, "https://job-medley.com/ans/1/", "京都府", "長岡京市")
    assert job.salary_min == 395000
    assert job.salary_max == 450000


def test_parse_job_detail_service_type(scraper):
    job = scraper._parse_job_detail(SAMPLE_HTML, "https://job-medley.com/ans/1/", "京都府", "長岡京市")
    assert job.service_type == "訪問看護ステーション"


def test_parse_job_detail_job_type_from_section_when_title_missing(scraper):
    """タイトルに職種がない場合、募集職種セクションから取得"""
    html = """
    <html><head><title>求人 | ジョブメドレー</title></head>
    <body>
    <h3>法人・施設名</h3><a href="/f/1">施設A</a>
    <h3>募集職種</h3><div>介護職/ヘルパー</div>
    <p>住所 東京都渋谷区</p>
    <p>月給250,000円</p>
    </body></html>
    """
    job = scraper._parse_job_detail(html, "https://job-medley.com/hh/1/", "東京都", "渋谷区")
    assert job.job_type == "介護職/ヘルパー"
