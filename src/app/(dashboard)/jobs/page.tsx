"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/ui";

type Job = {
  _id: string;
  facility_name?: string;
  prefecture?: string;
  city?: string;
  job_category?: string;
  job_type?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  job_url?: string;
  source?: string;
};

export default function JobsPage() {
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [prefectureDraft, setPrefectureDraft] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const exportHref = useMemo(() => {
    const p = new URLSearchParams();
    if (prefecture.trim()) p.set("prefecture", prefecture.trim());
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    return `/api/jobs/export${qs ? `?${qs}` : ""}`;
  }, [prefecture, q]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
    });
    if (prefecture.trim()) params.set("prefecture", prefecture.trim());
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/jobs?${params}`, { credentials: "include" });
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const data = await r.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
    setLoading(false);
  }, [page, prefecture, q]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(id);
  }, [load]);

  function applySearch() {
    setPrefecture(prefectureDraft);
    setQ(qDraft);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          求人一覧
        </h2>
        <p className="mt-1 text-sm text-sumi/75">
          MongoDB に保存された求人データです（{total.toLocaleString("ja-JP")}{" "}
          件）
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-sumi/80">
          都道府県
          <input
            className="rounded-lg border border-wash bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none ring-ai/20 focus:ring-2"
            value={prefectureDraft}
            onChange={(e) => setPrefectureDraft(e.target.value)}
            placeholder="例: 東京都"
          />
        </label>
        <label className="min-w-[200px] flex flex-1 flex-col gap-1 text-xs font-medium text-sumi/80">
          キーワード
          <input
            className="rounded-lg border border-wash bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none ring-ai/20 focus:ring-2"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="施設名・職種・市区町村"
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />
        </label>
        <button
          type="button"
          onClick={applySearch}
          className="rounded-lg bg-ai px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-aiMuted"
        >
          検索
        </button>
        <a
          href={exportHref}
          className="inline-flex items-center rounded-lg border border-wash bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-stone-50"
        >
          CSV ダウンロード
        </a>
      </div>
      <p className="text-xs text-sumi/65">
        ダウンロードは画面上部の検索条件に一致する求人を最大 5
        万件まで出力します（Excel 向け UTF-8 BOM 付き）。
      </p>

      <div className="overflow-x-auto rounded-2xl border border-wash bg-white shadow-card">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wash bg-stone-50/80 text-xs font-medium uppercase tracking-wide text-sumi/70">
              <th className="px-3 py-3">施設名</th>
              <th className="px-3 py-3">勤務地</th>
              <th className="px-3 py-3">職種</th>
              <th className="px-3 py-3">雇用</th>
              <th className="px-3 py-3">給与（下限〜上限）</th>
              <th className="px-3 py-3">source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-14">
                  <div className="flex justify-center">
                    <LoadingSpinner size="md" label="読み込み中…" />
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sumi/60">
                  該当する求人がありません
                </td>
              </tr>
            ) : (
              items.map((j) => (
                <tr
                  key={j._id}
                  className="border-b border-wash/80 last:border-0 hover:bg-stone-50/50"
                >
                  <td className="max-w-[220px] px-3 py-3 align-top">
                    <span className="line-clamp-2 font-medium text-ink">
                      {j.facility_name || "—"}
                    </span>
                    {j.job_url && (
                      <a
                        href={j.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-xs text-ai hover:underline"
                      >
                        求人ページ
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sumi">
                    {j.prefecture} {j.city}
                  </td>
                  <td className="max-w-[180px] px-3 py-3 text-sumi">
                    <div className="line-clamp-2">{j.job_category || "—"}</div>
                    <div className="line-clamp-1 text-xs text-sumi/70">
                      {j.job_type}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sumi">
                    {j.employment_type || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-sumi">
                    {j.salary_min ?? 0} 〜 {j.salary_max ?? 0}
                  </td>
                  <td className="px-3 py-3 text-xs text-sumi/80">{j.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-sumi">
        <span>
          ページ {page} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-wash bg-white px-3 py-1.5 disabled:opacity-40"
          >
            前へ
          </button>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-wash bg-white px-3 py-1.5 disabled:opacity-40"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
