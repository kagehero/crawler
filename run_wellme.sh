#!/usr/bin/env bash
# WellMe Job (kaigojob.com) 実行
# 入力: site_url_wellme_raks（レイクス21拠点一覧より）
# 出力: data/output_wellme_raks.csv

python3 main.py \
  --input site_url_wellme_raks \
  --output data/output_wellme_raks.csv \
  --output-dir data/pages/wellme \
  "$@"
