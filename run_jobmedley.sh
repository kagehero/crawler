#!/usr/bin/env bash
# Job Medley (job-medley.com) 実行
# 入力: site_url_jobmedley_raks（レイクス21拠点一覧より）
# 出力: data/output_jobmedley_raks.csv

python3 main.py \
  --input site_url_jobmedley_raks \
  --output data/output_jobmedley_raks.csv \
  --output-dir data/pages/jobmedley \
  "$@"
