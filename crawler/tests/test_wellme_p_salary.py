"""WellMe p-salary block parsing."""
from bs4 import BeautifulSoup

from scraper.wellme_job import _parse_salary_from_p_salary_block


def test_p_salary_daily_single():
    html = """
    <div class="p-salary">
      <i class="kj-icon-yen-circle p-salary__icon"></i>
      <span class="p-salary__header">日給</span>
      <span class="p-salary__content">
        <span class="p-salary__number">13,300</span>
        <span>円〜</span>
      </span>
    </div>
    """
    soup = BeautifulSoup(html, "lxml")
    mn, mx, pm = _parse_salary_from_p_salary_block(soup)
    assert mn == 13300
    assert mx == 0
    assert pm == "日給"


def test_p_salary_hourly_range():
    html = """
    <div class="p-salary">
      <span class="p-salary__header">時給</span>
      <span class="p-salary__content">
        <span class="p-salary__number">1,450</span>
        <span>円〜</span>
        <span class="p-salary__number">2,000</span>
        <span>円</span>
      </span>
    </div>
    """
    soup = BeautifulSoup(html, "lxml")
    mn, mx, pm = _parse_salary_from_p_salary_block(soup)
    assert mn == 1450
    assert mx == 2000
    assert pm == "時給"


def test_p_salary_missing():
    soup = BeautifulSoup("<p>no salary</p>", "lxml")
    assert _parse_salary_from_p_salary_block(soup) == (None, None, "")
