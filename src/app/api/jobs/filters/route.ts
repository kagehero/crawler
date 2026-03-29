import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";

function sortJa(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

/** 絞り込み UI 用の候補一覧（件数が多い DB でも distinct のみ） */
export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = await getDb();
  const col = db.collection("jobs");

  const [prefectures, sources, employmentTypes] = await Promise.all([
    col.distinct("prefecture", { prefecture: { $nin: [null, ""] } }),
    col.distinct("source"),
    col.distinct("employment_type", { employment_type: { $nin: [null, ""] } }),
  ]);

  return NextResponse.json({
    prefectures: sortJa(prefectures.map(String)),
    sources: sortJa(sources.map(String)),
    employmentTypes: sortJa(employmentTypes.map(String)).slice(0, 80),
  });
}
