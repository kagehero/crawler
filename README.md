# Crawler Project

ジョブメドレー（job-medley.com）の求人スクレイパー。

## セットアップ

```bash
pip install -r requirements.txt
playwright install chromium
```

## 実行

```bash
python3 main.py --input "site URL" --output data/output.csv
```

- `--output-dir DIR` … ページ別CSVの出力先（既定: data/pages）。各検索ページごとに即時保存し、データ損失を防止

`config.py` の `job_detail_concurrency`（既定: 5）で求人詳細の並列取得数を変更可能。
- `--max-areas N` … 地域をN件に制限（テスト用）
- `--excel` … Excelファイルから入力（city_id を API で解決）

## テスト

```bash
# 仮想環境を使用する場合
pip install -r requirements.txt  # pytest を含む
pytest tests/ -v

# または
python -m pytest tests/ -v
```

特定のテストのみ実行:

```bash
pytest tests/test_salary_parser.py -v
pytest tests/test_dedup.py -v
pytest tests/test_job_medley.py -v
```

統合テスト（実際に1地域スクレイピング）:

```bash
python3 main.py --max-areas 1
```
