"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/ui";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!file) {
      setErr("CSV ファイルを選択してください");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/import", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    setLoading(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.error ?? "取り込みに失敗しました");
      return;
    }
    setMsg(
      `取り込み完了（新規 upsert: ${data.upserted ?? 0}、更新: ${data.modified ?? 0}、行: ${data.rowCount ?? 0}）`
    );
  }

  return (
    <div className="max-w-xl space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          CSV 取り込み
        </h2>
        <p className="mt-1 text-sm text-sumi/75">
          Python スクレイパーが出力した UTF-8（BOM 可）の CSV をアップロードし、MongoDB に反映します。
          <code className="ml-1 rounded bg-wash px-1.5 py-0.5 text-xs">job_url</code>{" "}
          をキーに upsert します。
        </p>
      </header>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-2xl border border-wash bg-white p-8 shadow-card"
      >
        <label className="block text-sm font-medium text-sumi/90">
          ファイル
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm text-sumi file:mr-4 file:rounded-lg file:border-0 file:bg-wash file:px-4 file:py-2 file:text-sm file:font-medium file:text-ai hover:file:bg-stone-200"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-ai py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-aiMuted disabled:opacity-50"
        >
          {loading ? "取り込み中…" : "取り込む"}
        </button>
        {loading ? (
          <div className="mt-4">
            <ProgressBar indeterminate label="アップロード・取り込み処理中" size="sm" />
          </div>
        ) : null}
      </form>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      )}
    </div>
  );
}
