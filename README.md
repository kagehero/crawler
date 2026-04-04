# Crawler Project

介護・医療系求人サイトのスクレイパー（ジョブメドレー・ウェルミージョブ）と、Next.js 管理画面を **同一リポジトリ**（`crawler-project` ルート）にまとめています。

以前の `admin-web/` は廃止済みです。**`npm` は必ずリポジトリルート**（`package.json` があるディレクトリ）で実行してください。削除済みの `admin-web` にシェルのカレントディレクトリが残っていると、`uv_cwd` / `ENOENT` のように cwd が取れず失敗します（新しいタブで `cd` し直すと解消します）。

## レイアウト

| パス | 内容 |
|------|------|
| `crawler/` | Python（`main.py`、`site_url_*`、`input/` の Excel など。ジョブメドレー検索は HTTP） |
| `src/` | Next.js 管理画面（MongoDB・取り込み・Web からスクレイピング） |
| `src/lib/target-regions.ts` | 取得対象エリア（`crawler/site_url_wellme_raks` と対応）。求人一覧の都道府県候補は **ここを先頭** に並べ、その他は DB のみの県を続ける |
| `scripts/` | Node 補助（Mongo 接続テストなど） |
| `docs/` | 構成メモ（[STRUCTURE.md](docs/STRUCTURE.md)） |
| `package.json` | Node 依存（ルートで `npm install`） |

ルート直下の **`data/`** は旧出力の残りです。新規は **`crawler/data/`** を使用してください（[data/README.md](data/README.md)）。

## クライアント向け機能（要件対応の目安）

| 要件 | 実装 |
|------|------|
| 定期取得（週1・月1 等） | サーバー cron + [`crawler/scripts/cron_scrape_and_import.sh`](crawler/scripts/cron_scrape_and_import.sh)（スケジュールは環境側で設定） |
| ダウンロード | **求人一覧** の **CSV をダウンロード**（現在の絞り込みと同じ条件、最大 5 万件） |
| 一覧・検索 | **求人一覧**（キーワード、都道府県・市区町村、出所、雇用形態、職種、年収レンジ、並び替え、ページ分割） |
| ログイン | 環境変数 `ADMIN_SECRET` によるパスワード認証（HTTP-only Cookie） |

## Python スクレイパー（CLI）

```bash
cd crawler
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Job Medley

```bash
cd crawler
./run_jobmedley.sh
# または
python main.py --input site_url_jobmedley_raks --output data/output_jobmedley_raks.csv --output-dir data/pages/jobmedley
```

### WellMe Job

```bash
cd crawler
./run_wellme.sh
```

### オプション

- `--output-dir DIR` … ページ別 CSV の出力先
- `--max-areas N` … テスト用に地域数を制限
- `--excel` … Excel から入力（Job Medley のみ）

`crawler/config.py` の `job_detail_concurrency` で求人詳細の並列数を変更可能。

## 管理画面・MongoDB（Next.js）

リポジトリ**ルート**で:

```bash
cp .env.example .env.local
# .env.local を編集（MONGODB_URI, ADMIN_SECRET 必須）

npm install && npm run dev
```

ブラウザ: http://localhost:3000（未ログイン時は `/login`）

**スクレイピングを Web から使う場合**は `crawler/` に Python 依存を入れてください。

```bash
cd crawler
pip install -r requirements.txt
```

`npm run dev` / `npm start` は **リポジトリルート**で実行してください（`crawler/` の解決に使います）。

### MongoDB 接続の確認

```bash
npm run test:mongo
```

### MongoDB Atlas

1. [Atlas](https://cloud.mongodb.com/) でクラスタ作成、**Database Access** でユーザー。
2. **Network Access** で IP 許可。
3. `mongodb+srv://...` を `.env.local` の `MONGODB_URI` に設定（**Git に含めない**）。

### 環境変数（抜粋）

| 変数 | 説明 |
|------|------|
| `MONGODB_URI` | 必須 |
| `ADMIN_SECRET` | 必須（ログイン・Bearer） |
| `IMPORT_CSV_PATH` | 未設定時は `crawler/data/output.csv`（cwd はリポジトリルート） |
| `SCRAPER_PYTHON` | 任意（Playwright 入り venv を推奨） |

### Web からスクレイピング

管理画面 **スクレイピング** から `crawler/main.py` を実行可能。API: `POST /api/scrape/run`、JSON `{"importAfter":true,"maxAreas":1}`。

### 定期実行

[crawler/scripts/cron_scrape_and_import.sh](crawler/scripts/cron_scrape_and_import.sh) でスクレイプ後、`GET /api/cron/import` を `curl`。

## テスト

```bash
cd crawler
pip install -r requirements.txt
pytest tests/ -v
```

統合テスト（1 地域のみ）:

```bash
cd crawler
python main.py --max-areas 1
```

## 本番（Next）

```bash
npm run build
npm start
```
