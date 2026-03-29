import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import {
  buildJobsMongoFilter,
  jobsSortSpec,
  parseJobsSearchParams,
} from "@/lib/jobs-query";

const HEADER = [
  "facility_name",
  "prefecture",
  "city",
  "job_category",
  "job_type",
  "employment_type",
  "salary_min",
  "salary_max",
  "payment_method",
  "service_type",
  "job_url",
  "acquisition_date",
  "source",
  "importedAt",
] as const;

function cell(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(cell).join(",");
}

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = parseJobsSearchParams(searchParams, { isExport: true });
  const filter = buildJobsMongoFilter(q);
  const sort = jobsSortSpec(q.sort);

  const db = await getDb();
  const col = db.collection("jobs");
  const cursor = col
    .find(filter)
    .sort(sort)
    .limit(q.limit)
    .project({
      facility_name: 1,
      prefecture: 1,
      city: 1,
      job_category: 1,
      job_type: 1,
      employment_type: 1,
      salary_min: 1,
      salary_max: 1,
      payment_method: 1,
      service_type: 1,
      job_url: 1,
      acquisition_date: 1,
      source: 1,
      importedAt: 1,
    });

  const lines: string[] = [row([...HEADER])];
  for await (const doc of cursor) {
    lines.push(
      row([
        doc.facility_name as string,
        doc.prefecture as string,
        doc.city as string,
        doc.job_category as string,
        doc.job_type as string,
        doc.employment_type as string,
        doc.salary_min as number,
        doc.salary_max as number,
        doc.payment_method as string,
        doc.service_type as string,
        doc.job_url as string,
        doc.acquisition_date as string,
        doc.source as string,
        doc.importedAt instanceof Date
          ? doc.importedAt.toISOString()
          : String(doc.importedAt ?? ""),
      ])
    );
  }

  const body = "\uFEFF" + lines.join("\r\n");
  const name = `jobs_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
