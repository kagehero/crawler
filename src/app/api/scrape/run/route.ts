import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrBearer } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { importJobsFromCsvBuffer } from "@/lib/import-csv";
import {
  isCrawlerBundlePresent,
  resolveScraperOutputCsvPath,
  runScraper,
} from "@/lib/run-scraper";
import { isAllowedScrapeInputFile, SCRAPE_INPUT_FILES } from "@/lib/site-url-areas";

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
    selectableInputs: SCRAPE_INPUT_FILES.map((id) => ({
      id,
      label:
        id === "site_url_wellme_raks"
          ? "WellMe（kaigojob.com）"
          : "Job Medley（job-medley.com）",
    })),
    output: process.env.SCRAPER_OUTPUT ?? "data/output.csv",
    outputDir: process.env.SCRAPER_OUTPUT_DIR ?? "data/pages",
    python: process.env.SCRAPER_PYTHON ?? "python3",
  });
}

type Body = {
  maxAreas?: number;
  inputFile?: string;
  areaIndices?: number[];
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

  let inputFile: string | undefined;
  if (body.inputFile != null && String(body.inputFile).trim() !== "") {
    const f = String(body.inputFile).trim();
    if (!isAllowedScrapeInputFile(f)) {
      return NextResponse.json({ error: "inputFile が不正です" }, { status: 400 });
    }
    inputFile = f;
  }

  let areaIndices: number[] | undefined;
  if (Array.isArray(body.areaIndices) && body.areaIndices.length > 0) {
    areaIndices = body.areaIndices
      .map((n) => (typeof n === "number" ? Math.floor(n) : NaN))
      .filter((n) => Number.isInteger(n) && n >= 0);
    if (areaIndices.length === 0) areaIndices = undefined;
  }

  try {
    const result = await runScraper({
      maxAreas,
      inputFile,
      areaIndices,
    });

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
