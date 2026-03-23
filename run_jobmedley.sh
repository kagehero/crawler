#!/usr/bin/env bash
# Job Medley (job-medley.com) 実行
# 入力: site_url_jobmedley
# 出力: data/output_jobmedley.csv

python3 main.py \
  --input site_url_jobmedley \
  --output data/output_jobmedley.csv \
  --output-dir data/pages/jobmedley \
  "$@"
