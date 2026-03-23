#!/usr/bin/env bash
# WellMe Job (kaigojob.com) 実行
# 入力: site_url_wellme
# 出力: data/output_wellme.csv

python3 main.py \
  --input site_url_wellme \
  --output data/output_wellme.csv \
  --output-dir data/pages/wellme \
  "$@"
