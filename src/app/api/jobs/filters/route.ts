import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import {
  TARGET_REGIONS,
  targetPrefectureLabels,
} from "@/lib/target-regions";

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

  const [sources, employmentTypes] = await Promise.all([
    col.distinct("source"),
    col.distinct("employment_type", { employment_type: { $nin: [null, ""] } }),
  ]);

  return NextResponse.json({
    prefectures: targetPrefectureLabels(),
    sources: sortJa(sources.map(String)),
    employmentTypes: sortJa(employmentTypes.map(String)).slice(0, 80),
    /** 取得対象エリア（ウェルミー入力と対応） */
    targetRegions: TARGET_REGIONS,
  });
}
