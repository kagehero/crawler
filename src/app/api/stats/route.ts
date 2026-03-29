import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import {
  DEFAULT_SCHEDULE,
  SCHEDULE_DOC_ID,
  describeScheduleJa,
  normalizeSchedule,
} from "@/lib/schedule-settings";

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
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

    type ScheduleRow = {
      _id: string;
      mode?: string;
      weekday?: number;
      dayOfMonth?: number;
      hour?: number;
      minute?: number;
      updatedAt?: Date;
    };
    const scheduleDoc = await db
      .collection<ScheduleRow>("app_settings")
      .findOne({ _id: SCHEDULE_DOC_ID });
    const scheduleRaw = scheduleDoc
      ? {
          mode: scheduleDoc.mode as typeof DEFAULT_SCHEDULE.mode,
          weekday: scheduleDoc.weekday as number,
          dayOfMonth: scheduleDoc.dayOfMonth as number,
          hour: scheduleDoc.hour as number,
          minute: scheduleDoc.minute as number,
        }
      : DEFAULT_SCHEDULE;
    const schedule = normalizeSchedule(scheduleRaw);
    const periodicSchedule = {
      summary: describeScheduleJa(schedule),
      savedAt:
        scheduleDoc?.updatedAt instanceof Date
          ? scheduleDoc.updatedAt.toISOString()
          : null,
    };

    return NextResponse.json({
      totalJobs: total,
      lastRun,
      topPrefectures: byPref.map((x) => ({
        prefecture: x._id || "（未設定）",
        count: x.n,
      })),
      periodicSchedule,
    });
  } catch (e) {
    console.error("[api/stats]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "統計の取得に失敗しました",
        detail: msg,
      },
      { status: 500 },
    );
  }
}
