import { ObjectId } from "mongodb";
import { parse } from "csv-parse/sync";
import type { AnyBulkWriteOperation, Db, Document } from "mongodb";

export type JobDoc = {
  facility_name: string;
  prefecture: string;
  city: string;
  job_category: string;
  job_type: string;
  employment_type: string;
  salary_min: number;
  salary_max: number;
  payment_method: string;
  service_type: string;
  job_url: string;
  acquisition_date: string;
  source: "job_medley" | "wellme" | "unknown";
  importedAt: Date;
  runId: string;
};

function detectSource(jobUrl: string): JobDoc["source"] {
  if (jobUrl.includes("kaigojob.com")) return "wellme";
  if (jobUrl.includes("job-medley.com")) return "job_medley";
  return "unknown";
}

function num(v: string | undefined): number {
  if (v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function importJobsFromCsvBuffer(
  buffer: Buffer,
  db: Db,
  options: { trigger: "cron" | "manual" | "api" | "scrape" }
): Promise<{ upserted: number; modified: number; runId: string; rowCount: number }> {
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const runObjectId = new ObjectId();
  const runId = runObjectId.toHexString();
  const startedAt = new Date();
  const col = db.collection("jobs");

  const ops: AnyBulkWriteOperation<Document>[] = [];
  let rowCount = 0;

  for (const row of records) {
    const job_url = (row.job_url ?? "").trim();
    if (!job_url) continue;
    rowCount += 1;

    const doc: JobDoc = {
      facility_name: row.facility_name ?? "",
      prefecture: row.prefecture ?? "",
      city: row.city ?? "",
      job_category: row.job_category ?? "",
      job_type: row.job_type ?? "",
      employment_type: row.employment_type ?? "",
      salary_min: num(row.salary_min),
      salary_max: num(row.salary_max),
      payment_method: row.payment_method ?? "",
      service_type: row.service_type ?? "",
      job_url,
      acquisition_date: row.acquisition_date ?? "",
      source: detectSource(job_url),
      importedAt: startedAt,
      runId,
    };

    ops.push({
      updateOne: {
        filter: { job_url },
        update: { $set: doc as Document },
        upsert: true,
      },
    });
  }

  let upserted = 0;
  let modified = 0;
  const chunk = 500;
  for (let i = 0; i < ops.length; i += chunk) {
    const slice = ops.slice(i, i + chunk);
    const r = await col.bulkWrite(slice, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
  }

  const finishedAt = new Date();
  await db.collection("scrape_runs").insertOne({
    _id: runObjectId,
    startedAt,
    finishedAt,
    jobCount: rowCount,
    status: "success",
    trigger: options.trigger,
  });

  return { upserted, modified, runId, rowCount };
}
