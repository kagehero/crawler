import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrBearer } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { importJobsFromCsvBuffer } from "@/lib/import-csv";
import {
  getCrawlerRoot,
  isCrawlerBundlePresent,
  resolveScraperOutputCsvPath,
  runScraper,
} from "@/lib/run-scraper";

export const runtime = "nodejs";
/**
 * Vercel Hobby: 最大 300 秒（この値を超えるとデプロイが拒否されます）。
 * Pro 等でも上限はプラン依存 — 長時間スクレイプは cron + 別ワーカー推奨。
 */
export const maxDuration = 300;

/** スクレイパー設定の参照（秘密は含めない） */
export async function GET(request: NextRequest) {
  if (!verifyAdminOrBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const configured = isCrawlerBundlePresent();
  return NextResponse.json({
    configured,
    bundle: "crawler",
    input: process.env.SCRAPER_INPUT ?? "site_url_jobmedley_raks",
    output: process.env.SCRAPER_OUTPUT ?? "data/output.csv",
    outputDir: process.env.SCRAPER_OUTPUT_DIR ?? "data/pages",
    python: process.env.SCRAPER_PYTHON ?? "python3",
  });
}

type Body = {
  maxAreas?: number;
  /** true のとき、成功後に出力 CSV を MongoDB に取り込む */
  importAfter?: boolean;
};

/**
 * Python スクレイパー（main.py）をサーバー上で実行する。
 * 認証: 管理画面ログイン Cookie または Authorization: Bearer
 *
 * スクレイパーはリポジトリ直下の `crawler/`（SCRAPER_ROOT は任意の上書き用）。
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminOrBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!isCrawlerBundlePresent()) {
    return NextResponse.json(
      {
        error:
          "crawler/main.py がありません。npm run dev はリポジトリルートで実行してください。",
      },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    const t = await request.text();
    if (t) body = JSON.parse(t) as Body;
  } catch {
    return NextResponse.json({ error: "JSON ボディが不正です" }, { status: 400 });
  }

  const maxAreas =
    typeof body.maxAreas === "number" && body.maxAreas > 0
      ? Math.min(500, Math.floor(body.maxAreas))
      : undefined;
  const importAfter = Boolean(body.importAfter);

  try {
    const result = await runScraper({ maxAreas });

    let importResult: Awaited<
      ReturnType<typeof importJobsFromCsvBuffer>
    > | null = null;

    if (importAfter && result.exitCode === 0) {
      const csvPath = resolveScraperOutputCsvPath();
      const buffer = await readFile(csvPath);
      const db = await getDb();
      importResult = await importJobsFromCsvBuffer(buffer, db, {
        trigger: "scrape",
      });
    }

    return NextResponse.json({
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: result.durationMs,
      stdout: tail(result.stdout, 120_000),
      stderr: tail(result.stderr, 60_000),
      import: importResult,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function tail(s: string, max: number): string {
  if (s.length <= max) return s;
  return "…(省略)\n" + s.slice(-max);
}
