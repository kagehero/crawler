import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = await getDb();
  const total = await db.collection("jobs").countDocuments();
  const lastRun = await db
    .collection("scrape_runs")
    .findOne({}, { sort: { finishedAt: -1 } });

  const byPref = await db
    .collection("jobs")
    .aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$prefecture", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 12 },
    ])
    .toArray();

  return NextResponse.json({
    totalJobs: total,
    lastRun,
    topPrefectures: byPref.map((x) => ({ prefecture: x._id || "（未設定）", count: x.n })),
  });
}
