import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10) || 30));
  const prefecture = searchParams.get("prefecture")?.trim();
  const q = searchParams.get("q")?.trim();

  const db = await getDb();
  const filter: Record<string, unknown> = {};
  if (prefecture) filter.prefecture = prefecture;
  if (q) {
    filter.$or = [
      { facility_name: { $regex: q, $options: "i" } },
      { job_type: { $regex: q, $options: "i" } },
      { city: { $regex: q, $options: "i" } },
    ];
  }

  const col = db.collection("jobs");
  const total = await col.countDocuments(filter);
  const items = await col
    .find(filter)
    .sort({ importedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}
