"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui";

type Run = {
  _id: string;
  startedAt?: string;
  finishedAt?: string;
  jobCount?: number;
  status?: string;
  trigger?: string;
};

export default function RunsPage() {
  const [items, setItems] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          取り込み履歴
        </h2>
        <p className="mt-1 text-sm text-sumi/75">
          CSV 取り込み・定期ジョブの実行ごとの記録です。
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-wash bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wash bg-stone-50/80 text-xs font-medium uppercase tracking-wide text-sumi/70">
              <th className="px-4 py-3">終了時刻</th>
              <th className="px-4 py-3 text-right">件数</th>
              <th className="px-4 py-3">トリガー</th>
              <th className="px-4 py-3">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-14">
                  <div className="flex justify-center">
                    <LoadingSpinner size="md" label="読み込み中…" />
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sumi/60">
                  履歴がありません
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r._id} className="border-b border-wash/80 last:border-0">
                  <td className="px-4 py-3 text-sumi">
                    {r.finishedAt
                      ? new Date(r.finishedAt).toLocaleString("ja-JP")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {(r.jobCount ?? 0).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-wash px-2 py-0.5 text-xs text-sumi">
                      {r.trigger ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-emerald-800">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
