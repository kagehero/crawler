import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getDb } from "@/lib/mongodb";
import { importJobsFromCsvBuffer } from "@/lib/import-csv";
import { verifyAdminOrBearer, verifyBearer } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAdminOrBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const ct = request.headers.get("content-type") ?? "";
  let buffer: Buffer;

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file が必要です" }, { status: 400 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    return NextResponse.json(
      { error: "multipart/form-data で CSV を送信してください" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const result = await importJobsFromCsvBuffer(buffer, db, { trigger: "manual" });
  return NextResponse.json(result);
}

/** サーバー上の CSV パスから取り込み（Bearer のみ） */
export async function PUT(request: NextRequest) {
  if (!verifyBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const raw = process.env.IMPORT_CSV_PATH;
  const csvPath = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw)
    : path.resolve(process.cwd(), "crawler/data/output.csv");

  const buffer = await readFile(csvPath);
  const db = await getDb();
  const result = await importJobsFromCsvBuffer(buffer, db, { trigger: "api" });
  return NextResponse.json({ ...result, path: csvPath });
}
