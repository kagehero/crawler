"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner, ProgressBar } from "@/components/ui";

type ScrapeConfig = {
  configured: boolean;
  bundle?: string;
  input: string;
  output: string;
  outputDir: string;
  python: string;
};

type ScrapeResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  import?: {
    upserted: number;
    modified: number;
    rowCount: number;
    runId: string;
  } | null;
  error?: string;
};

export default function ScrapePage() {
  const [cfg, setCfg] = useState<ScrapeConfig | null>(null);
  const [maxAreas, setMaxAreas] = useState("");
  const [importAfter, setImportAfter] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadCfg = useCallback(() => {
    fetch("/api/scrape/run", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("設定の取得に失敗しました");
        return r.json();
      })
      .then(setCfg)
      .catch((e) =>
        setLoadErr(e instanceof Error ? e.message : "エラー")
      );
  }, []);

  useEffect(() => {
    loadCfg();
  }, [loadCfg]);

  async function runScrape() {
    setResult(null);
    setRunning(true);
    const body: { maxAreas?: number; importAfter: boolean } = {
      importAfter,
    };
    const n = parseInt(maxAreas, 10);
    if (!Number.isNaN(n) && n > 0) body.maxAreas = n;

    const r = await fetch("/api/scrape/run", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await r.json()) as ScrapeResult;
    setRunning(false);
    if (!r.ok) {
      setResult({
        ok: false,
        exitCode: null,
        durationMs: 0,
        error: data.error ?? `HTTP ${r.status}`,
      });
      return;
    }
    setResult(data);
  }

  if (loadErr) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
        {loadErr}
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="設定を読み込み中…" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          スクレイピング
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-sumi/80">
          サーバーに Python
          が用意されている場合、ここから求人サイトの取得を開始できます。クラウド（Vercel
          など）では制限があることが多いので、通常は専用サーバーでの運用を想定しています。
        </p>
      </header>

      {!cfg.configured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">スクレイパー同梱フォルダが見つかりません</p>
          <p className="mt-2 text-amber-900/90">
            <code className="rounded bg-white/80 px-1">crawler/main.py</code>{" "}
            があることを確認し、ターミナルではリポジトリルートで{" "}
            <code className="rounded bg-white/80 px-1">npm run dev</code>{" "}
            を実行してください。
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-wash bg-white p-6 shadow-card">
          <h3 className="text-sm font-semibold text-ink">
            現在の設定
            {cfg.bundle ? (
              <span className="ml-2 font-mono text-xs font-normal text-sumi/70">
                （{cfg.bundle}）
              </span>
            ) : null}
          </h3>
          <dl className="mt-3 grid gap-2 text-sm text-sumi">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-sumi/70">Python:</dt>
              <dd className="font-mono text-xs">{cfg.python}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-sumi/70">入力ファイル:</dt>
              <dd className="font-mono text-xs">{cfg.input}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-sumi/70">出力 CSV:</dt>
              <dd className="font-mono text-xs">{cfg.output}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-sumi/70">ページ別 CSV 先:</dt>
              <dd className="font-mono text-xs">{cfg.outputDir}</dd>
            </div>
          </dl>
        </div>
      )}

      <form
        className="rounded-2xl border border-wash bg-white p-8 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void runScrape();
        }}
      >
        <div className="space-y-5">
          <label className="block text-sm font-medium text-sumi/90">
            最大地域数（空欄で全件・テスト用に数値）
            <input
              type="number"
              min={1}
              max={500}
              placeholder="例: 1"
              className="mt-2 w-full max-w-xs rounded-lg border border-wash bg-paper px-3 py-2 text-sm tabular-nums outline-none ring-ai/20 focus:ring-2"
              value={maxAreas}
              onChange={(e) => setMaxAreas(e.target.value)}
              disabled={!cfg.configured || running}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-sumi">
            <input
              type="checkbox"
              className="rounded border-wash text-ai focus:ring-ai"
              checked={importAfter}
              onChange={(e) => setImportAfter(e.target.checked)}
              disabled={!cfg.configured || running}
            />
            成功後に出力 CSV を MongoDB に取り込む
          </label>
        </div>
        <button
          type="submit"
          disabled={!cfg.configured || running}
          className="mt-8 w-full rounded-xl bg-ai py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-aiMuted disabled:opacity-50"
        >
          {running ? "実行中…" : "スクレイピングを実行"}
        </button>
        {running ? (
          <div className="mt-4 space-y-3">
            <ProgressBar indeterminate label="Playwright 実行中（完了までしばらくかかります）" />
            <LoadingSpinner size="sm" />
          </div>
        ) : null}
      </form>

      {result ? (
        <div className="space-y-3">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              result.ok
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                : "border-red-200 bg-red-50/80 text-red-900"
            }`}
          >
            <p className="font-medium">
              {result.ok ? "完了" : "失敗またはエラー"}
              {result.exitCode != null ? `（終了コード ${result.exitCode}）` : ""}
              {result.durationMs != null
                ? ` · ${(result.durationMs / 1000).toFixed(1)} 秒`
                : ""}
            </p>
            {result.error ? <p className="mt-1">{result.error}</p> : null}
            {result.import ? (
              <p className="mt-2 text-emerald-900">
                MongoDB: 新規 upsert {result.import.upserted} / 更新{" "}
                {result.import.modified} / 行 {result.import.rowCount}
              </p>
            ) : null}
          </div>
          {(result.stderr || result.stdout) ? (
            <div className="overflow-hidden rounded-xl border border-wash bg-stone-900/95">
              <p className="border-b border-stone-700 px-3 py-2 text-xs text-stone-400">
                ログ（末尾）
              </p>
              <pre className="max-h-80 overflow-auto p-4 font-mono text-xs text-stone-100 whitespace-pre-wrap">
                {result.stderr ? `[stderr]\n${result.stderr}\n\n` : ""}
                {result.stdout ? `[stdout]\n${result.stdout}` : ""}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
