import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getDb } from "@/lib/mongodb";
import { importJobsFromCsvBuffer } from "@/lib/import-csv";
import { verifyBearer } from "@/lib/auth";

/** 既定: リポジトリルートの cwd から `crawler/data/output.csv` */
function resolveCronImportCsvPath(): string {
  const p = process.env.IMPORT_CSV_PATH;
  if (p) {
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  return path.resolve(process.cwd(), "crawler/data/output.csv");
}

/**
 * 定期実行: 同梱スクレイパー出力 CSV を MongoDB に取り込む。
 * 認証: Authorization: Bearer <CRON_SECRET>（未設定時は ADMIN_SECRET）
 *
 * `IMPORT_CSV_PATH` 未設定時は `crawler/data/output.csv`（`npm run dev` はリポジトリルートで実行）。
 */
export async function GET(request: NextRequest) {
  if (!verifyBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const csvPath = resolveCronImportCsvPath();

  try {
    const buffer = await readFile(csvPath);
    const db = await getDb();
    const result = await importJobsFromCsvBuffer(buffer, db, { trigger: "cron" });
    return NextResponse.json({ ok: true, path: csvPath, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
