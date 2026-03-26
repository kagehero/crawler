"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const search = useSearchParams();
  const from = search.get("from") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? "ログインに失敗しました");
      return;
    }
    window.location.href = from;
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-10 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sumi/60">
          Crawler Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ai">管理コンソール</h1>
        <p className="mt-2 text-sm text-sumi/75">
          パスワードは環境変数 <code className="text-xs">ADMIN_SECRET</code>{" "}
          と同じ値です。
        </p>
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-2xl border border-wash bg-white p-8 shadow-card"
      >
        <label className="block text-sm font-medium text-sumi/90">
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-wash bg-paper px-4 py-3 text-ink outline-none ring-ai/20 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-ai py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-aiMuted disabled:opacity-50"
        >
          {loading ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
