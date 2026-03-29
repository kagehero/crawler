import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import {
  buildJobsMongoFilter,
  jobsSortSpec,
  parseJobsSearchParams,
} from "@/lib/jobs-query";

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = parseJobsSearchParams(searchParams);
  const filter = buildJobsMongoFilter(q);
  const sort = jobsSortSpec(q.sort);

  const db = await getDb();
  const col = db.collection("jobs");
  const total = await col.countDocuments(filter);
  const items = await col
    .find(filter)
    .sort(sort)
    .skip((q.page - 1) * q.limit)
    .limit(q.limit)
    .toArray();

  return NextResponse.json({
    items,
    total,
    page: q.page,
    limit: q.limit,
    pages: Math.ceil(total / q.limit) || 1,
  });
}
