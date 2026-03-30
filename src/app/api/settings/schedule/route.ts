import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyBrowserAuth } from "@/lib/auth";
import {
  DEFAULT_SCHEDULE,
  SCHEDULE_DOC_ID,
  normalizeSchedule,
  type ScheduleSettings,
} from "@/lib/schedule-settings";

type Stored = ScheduleSettings & {
  _id: typeof SCHEDULE_DOC_ID;
  updatedAt: Date;
};

export async function GET(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = await getDb();
  const doc = await db.collection<Stored>("app_settings").findOne({
    _id: SCHEDULE_DOC_ID,
  });

  const settings = doc
    ? normalizeSchedule({
        mode: doc.mode,
        weekday: doc.weekday,
        dayOfMonth: doc.dayOfMonth,
        hour: doc.hour,
        minute: doc.minute,
      })
    : DEFAULT_SCHEDULE;

  return NextResponse.json({
    settings,
    updatedAt: doc?.updatedAt?.toISOString() ?? null,
  });
}

export async function PUT(request: NextRequest) {
  if (!verifyBrowserAuth(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正な JSON です" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const settings = normalizeSchedule({
    mode: b.mode as ScheduleSettings["mode"],
    weekday: typeof b.weekday === "number" ? b.weekday : Number(b.weekday),
    dayOfMonth:
      typeof b.dayOfMonth === "number" ? b.dayOfMonth : Number(b.dayOfMonth),
    hour: typeof b.hour === "number" ? b.hour : Number(b.hour),
    minute: typeof b.minute === "number" ? b.minute : Number(b.minute),
  });

  const now = new Date();
  const stored: Stored = {
    _id: SCHEDULE_DOC_ID,
    ...settings,
    updatedAt: now,
  };

  const db = await getDb();
  await db.collection<Stored>("app_settings").replaceOne(
    { _id: SCHEDULE_DOC_ID },
    stored,
    { upsert: true }
  );

  return NextResponse.json({
    ok: true,
    settings,
    updatedAt: now.toISOString(),
  });
}
