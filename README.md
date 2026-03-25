# Crawler Project

介護・医療系求人サイトのスクレイパー。ジョブメドレー（job-medley.com）とウェルミージョブ（kaigojob.com）に対応。

## セットアップ

```bash
pip install -r requirements.txt
playwright install chromium
```

## 実行

### Job Medley

| 項目 | 内容 |
|------|------|
| 入力 | `site_url_jobmedley` |
| 出力 | `data/output_jobmedley.csv` |

```bash
# スクリプト
./run_jobmedley.sh

# または直接
python3 main.py --input site_url_jobmedley --output data/output_jobmedley.csv --output-dir data/pages/jobmedley
```

### WellMe Job

| 項目 | 内容 |
|------|------|
| 入力 | `site_url_wellme` |
| 出力 | `data/output_wellme.csv` |

```bash
# スクリプト
./run_wellme.sh

# または直接
python3 main.py --input site_url_wellme --output data/output_wellme.csv --output-dir data/pages/wellme
```

### オプション

- `--output-dir DIR` … ページ別CSVの出力先。各検索ページごとに即時保存し、データ損失を防止
- `--max-areas N` … 地域をN件に制限（テスト用）
- `--excel` … Excelファイルから入力（Job Medley のみ、city_id を API で解決）

`config.py` の `job_detail_concurrency`（既定: 5）で求人詳細の並列取得数を変更可能。

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
