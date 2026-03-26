# ディレクトリ構成

```
crawler-project/
├── docs/                 # ドキュメント（本ファイルなど）
├── crawler/              # Python スクレイパー
│   ├── input/            # Excel 等の入力（Git に含めるかは要検討）
│   ├── data/             # 出力 CSV（主に .gitignore）
│   ├── scraper/
│   ├── exporter/
│   ├── parser/
│   ├── utils/
│   ├── tests/
│   ├── scripts/        # cron・補助スクリプト
│   ├── main.py
│   └── requirements.txt
├── src/                  # Next.js（App Router）
│   ├── app/
│   ├── components/
│   └── lib/
├── scripts/              # Node 用開発補助（Mongo 接続テスト等）
├── package.json          # Next.js / 管理画面の依存
├── next.config.mjs
├── tsconfig.json
├── .env.example
└── README.md
```

- **作業ディレクトリ**: 管理画面はリポジトリ**ルート**で `npm run dev`。スクレイパー CLI は `cd crawler`。
- **仮想環境**: ルートの `.venv` / `venv` は Python 用（Next のビルドからは `webpack` / `watchOptions` で無視）。
