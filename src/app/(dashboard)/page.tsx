"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui";

type Stats = {
  totalJobs: number;
  lastRun: {
    finishedAt?: string;
    jobCount?: number;
    trigger?: string;
    status?: string;
  } | null;
  topPrefectures: { prefecture: string; count: number }[];
};

export default function HomePage() {
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("読み込みに失敗しました");
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" label="読み込み中…" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          ダッシュボード
        </h2>
        <p className="mt-1 text-sm text-sumi/75">
          求人データの件数と直近の取り込み状況です。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-wash bg-white p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-sumi/60">
            登録求人
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-ai">
            {data.totalJobs.toLocaleString("ja-JP")}
            <span className="ml-1 text-base font-normal text-sumi/70">件</span>
          </p>
        </div>
        <div className="rounded-2xl border border-wash bg-white p-6 shadow-card sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-sumi/60">
            直近の取り込み
          </p>
          {data.lastRun ? (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span className="text-sumi/80">
                {data.lastRun.finishedAt
                  ? new Date(data.lastRun.finishedAt).toLocaleString("ja-JP")
                  : "—"}
              </span>
              <span className="tabular-nums text-ink">
                {data.lastRun.jobCount?.toLocaleString("ja-JP") ?? "—"} 件
              </span>
              <span className="rounded-full bg-wash px-2 py-0.5 text-xs text-sumi">
                {data.lastRun.trigger ?? "—"}
              </span>
              <span className="text-emerald-700">{data.lastRun.status}</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-sumi/70">まだ取り込み履歴がありません。</p>
          )}
        </div>
      </div>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-ink">都道府県別（上位）</h3>
        <div className="overflow-hidden rounded-2xl border border-wash bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-wash bg-stone-50/80 text-xs font-medium uppercase tracking-wide text-sumi/70">
                <th className="px-4 py-3">都道府県</th>
                <th className="px-4 py-3 text-right">件数</th>
              </tr>
            </thead>
            <tbody>
              {data.topPrefectures.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sumi/60">
                    データがありません
                  </td>
                </tr>
              ) : (
                data.topPrefectures.map((row) => (
                  <tr
                    key={row.prefecture}
                    className="border-b border-wash/80 last:border-0"
                  >
                    <td className="px-4 py-3 text-ink">{row.prefecture}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sumi">
                      {row.count.toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
