"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_LABELS,
  describeScheduleJa,
  normalizeSchedule,
  type ScheduleSettings,
} from "@/lib/schedule-settings";

function toTimeInputValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeInput(v: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return { hour: DEFAULT_SCHEDULE.hour, minute: DEFAULT_SCHEDULE.minute };
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return { hour: h, minute: min };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [mode, setMode] = useState<ScheduleSettings["mode"]>("weekly");
  const [weekday, setWeekday] = useState(DEFAULT_SCHEDULE.weekday);
  const [dayOfMonth, setDayOfMonth] = useState(DEFAULT_SCHEDULE.dayOfMonth);
  const [timeStr, setTimeStr] = useState(
    toTimeInputValue(DEFAULT_SCHEDULE.hour, DEFAULT_SCHEDULE.minute)
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const r = await fetch("/api/settings/schedule", { credentials: "include" });
    setLoading(false);
    if (!r.ok) {
      setErr("設定の読み込みに失敗しました");
      return;
    }
    const data = await r.json();
    const s = normalizeSchedule(data.settings ?? {});
    setMode(s.mode);
    setWeekday(s.weekday);
    setDayOfMonth(s.dayOfMonth);
    setTimeStr(toTimeInputValue(s.hour, s.minute));
    setUpdatedAt(data.updatedAt ?? null);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(id);
  }, [load]);

  const preview = normalizeSchedule({
    mode,
    weekday,
    dayOfMonth,
    ...parseTimeInput(timeStr),
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { hour, minute } = parseTimeInput(timeStr);
    const body = normalizeSchedule({
      mode,
      weekday,
      dayOfMonth,
      hour,
      minute,
    });
    const r = await fetch("/api/settings/schedule", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.error ?? "保存に失敗しました");
      return;
    }
    setMsg("保存しました");
    setUpdatedAt(data.updatedAt ?? null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" label="読み込み中…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          設定
        </h1>
        <p className="text-sm leading-relaxed text-sumi/80">
          定期で求人データを取り込む「希望のタイミング」を登録します。
        </p>
      </header>

      <form
        onSubmit={(e) => void onSave(e)}
        className="space-y-6 rounded-2xl border border-wash bg-white p-6 shadow-card sm:p-8"
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">繰り返し</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-wash bg-paper/50 px-4 py-3 has-[:checked]:border-ai/40 has-[:checked]:bg-ai/5">
              <input
                type="radio"
                name="mode"
                checked={mode === "weekly"}
                onChange={() => setMode("weekly")}
                className="text-ai focus:ring-ai"
              />
              <span className="text-sm font-medium text-ink">毎週</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-wash bg-paper/50 px-4 py-3 has-[:checked]:border-ai/40 has-[:checked]:bg-ai/5">
              <input
                type="radio"
                name="mode"
                checked={mode === "biweekly"}
                onChange={() => setMode("biweekly")}
                className="text-ai focus:ring-ai"
              />
              <span className="text-sm font-medium text-ink">隔週</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-wash bg-paper/50 px-4 py-3 has-[:checked]:border-ai/40 has-[:checked]:bg-ai/5">
              <input
                type="radio"
                name="mode"
                checked={mode === "monthly"}
                onChange={() => setMode("monthly")}
                className="text-ai focus:ring-ai"
              />
              <span className="text-sm font-medium text-ink">毎月</span>
            </label>
          </div>
        </fieldset>

        {mode === "weekly" || mode === "biweekly" ? (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">曜日</span>
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="w-full rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
            >
              {WEEKDAY_LABELS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">日付（毎月）</span>
            <select
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              className="w-full rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}日
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">時刻</span>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="w-full max-w-[12rem] rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
          />
        </label>

        <div className="rounded-xl border border-wash bg-paper/60 px-4 py-3 text-sm text-sumi/90">
          <p className="font-medium text-ink">プレビュー</p>
          <p className="mt-1">{describeScheduleJa(preview)}</p>
        </div>

        {err && (
          <p className="text-sm text-red-700" role="alert">
            {err}
          </p>
        )}
        {msg && (
          <p className="text-sm text-emerald-800" role="status">
            {msg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-ai px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-aiMuted disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
          {updatedAt && (
            <span className="text-xs text-sumi/65">
              最終更新: {new Date(updatedAt).toLocaleString("ja-JP")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
