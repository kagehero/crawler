#!/usr/bin/env bash
# 例: crontab
#   0 3 * * * /path/to/crawler-project/crawler/scripts/cron_scrape_and_import.sh >> /var/log/crawler-cron.log 2>&1
set -euo pipefail

CRAWLER="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CRAWLER"

PROJECT_ROOT="$(cd "$CRAWLER/.." && pwd)"

# Python venv（リポジトリ直下 .venv を優先）
if [[ -f "$PROJECT_ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.venv/bin/activate"
elif [[ -f "$CRAWLER/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$CRAWLER/.venv/bin/activate"
elif [[ -f "$PROJECT_ROOT/venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/venv/bin/activate"
fi

INPUT="${CRAWLER_INPUT:-$CRAWLER/site_url_jobmedley_raks}"
OUTPUT="${CRAWLER_OUTPUT:-$CRAWLER/data/output.csv}"

python main.py --input "$INPUT" --output "$OUTPUT" --output-dir "${CRAWLER_OUTPUT_DIR:-$CRAWLER/data/pages}"

# Next 管理画面の取り込み API（同一マシン想定）
IMPORT_URL="${CRON_IMPORT_URL:-http://127.0.0.1:3000/api/cron/import}"
SECRET="${CRON_SECRET:-${ADMIN_SECRET:-}}"

if [[ -z "$SECRET" ]]; then
  echo "[warn] CRON_SECRET / ADMIN_SECRET が未設定のため import をスキップします"
  exit 0
fi

curl -sS -f -H "Authorization: Bearer $SECRET" "$IMPORT_URL" | head -c 2000
echo
