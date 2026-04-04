import type { Collection, Document } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import { canonicalEmploymentOptions } from "@/lib/employment-normalization";
import {
  TARGET_REGIONS,
  targetPrefectureLabels,
} from "@/lib/target-regions";

const SOURCES = ["job_medley", "wellme", "unknown"] as const;

function sortJa(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

/** 媒体ごとの distinct（職種・サービス種別のプルダウン用） */
async function distinctBySource(
  col: Collection<Document>,
  field: string
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const src of SOURCES) {
    const vals = await col.distinct(field, {
      source: src,
      [field]: { $nin: [null, ""] },
    });
    out[src] = sortJa(vals.map(String));
  }
  return out;
}

/** 絞り込み UI 用の候補一覧（件数が多い DB でも distinct のみ） */
export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = await getDb();
  const col = db.collection("jobs");

  const [employmentRaw, jobCategoriesBySource, serviceTypesBySource] =
    await Promise.all([
      col.distinct("employment_type", {
        employment_type: { $nin: [null, ""] },
      }),
      distinctBySource(col, "job_category"),
      distinctBySource(col, "service_type"),
    ]);

  return NextResponse.json({
    prefectures: targetPrefectureLabels(),
    sources: sortJa((await col.distinct("source")).map(String)),
    employmentTypes: canonicalEmploymentOptions(employmentRaw.map(String)).slice(
      0,
      80
    ),
    jobCategoriesBySource,
    serviceTypesBySource,
    targetRegions: TARGET_REGIONS,
  });
}
