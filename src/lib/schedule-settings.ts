/** 定期取得の希望スケジュール（MongoDB に保存。実際の cron はサーバー側で設定） */

export type ScheduleMode = "weekly" | "biweekly" | "monthly";

export type ScheduleSettings = {
  mode: ScheduleMode;
  /** 0=日曜 … 6=土曜（JavaScript の getDay() と同じ） */
  weekday: number;
  /** 毎月の日（1–31） */
  dayOfMonth: number;
  hour: number;
  minute: number;
};

export const SCHEDULE_DOC_ID = "schedule" as const;

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  mode: "weekly",
  weekday: 1,
  dayOfMonth: 1,
  hour: 3,
  minute: 0,
};

export const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: "日曜日" },
  { value: 1, label: "月曜日" },
  { value: 2, label: "火曜日" },
  { value: 3, label: "水曜日" },
  { value: 4, label: "木曜日" },
  { value: 5, label: "金曜日" },
  { value: 6, label: "土曜日" },
];

function finiteInt(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

export function normalizeSchedule(input: Partial<ScheduleSettings>): ScheduleSettings {
  const mode =
    input.mode === "monthly" ||
    input.mode === "weekly" ||
    input.mode === "biweekly"
      ? input.mode
      : "weekly";
  const wd = finiteInt(input.weekday, DEFAULT_SCHEDULE.weekday);
  const weekday = wd >= 0 && wd <= 6 ? wd : DEFAULT_SCHEDULE.weekday;
  const dm = finiteInt(input.dayOfMonth, DEFAULT_SCHEDULE.dayOfMonth);
  const dayOfMonth = dm >= 1 && dm <= 31 ? dm : DEFAULT_SCHEDULE.dayOfMonth;
  const h = finiteInt(input.hour, DEFAULT_SCHEDULE.hour);
  const hour = h >= 0 && h <= 23 ? h : DEFAULT_SCHEDULE.hour;
  const mi = finiteInt(input.minute, DEFAULT_SCHEDULE.minute);
  const minute = mi >= 0 && mi <= 59 ? mi : DEFAULT_SCHEDULE.minute;

  return { mode, weekday, dayOfMonth, hour, minute };
}

/** Linux crontab 形式の参考（分 時 …）。サーバーのタイムゾーンに依存 */
export function scheduleToCronLine(s: ScheduleSettings): string {
  const { minute, hour, weekday, dayOfMonth, mode } = s;
  if (mode === "weekly" || mode === "biweekly") {
    /** 隔週は標準 cron では表現できないため、週次と同じ行を返す（実運用はスクリプトで隔週判定が必要な場合あり） */
    return `${minute} ${hour} * * ${weekday}`;
  }
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

export function describeScheduleJa(s: ScheduleSettings): string {
  const hm = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
  if (s.mode === "weekly") {
    const w = WEEKDAY_LABELS.find((x) => x.value === s.weekday)?.label ?? "指定曜日";
    return `毎週${w}の ${hm}`;
  }
  if (s.mode === "biweekly") {
    const w = WEEKDAY_LABELS.find((x) => x.value === s.weekday)?.label ?? "指定曜日";
    return `隔週${w}の ${hm}`;
  }
  return `毎月${s.dayOfMonth}日の ${hm}`;
}
