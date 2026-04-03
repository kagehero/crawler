"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingSpinner, ProgressBar } from "@/components/ui";

type ScrapeConfig = {
  configured: boolean;
  bundle?: string;
  input: string;
  output: string;
  outputDir: string;
  python: string;
};

type ImportSummary = {
  upserted: number;
  modified: number;
  rowCount: number;
  runId: string;
};

type ScrapeResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  import?: ImportSummary | null;
  error?: string;
};

export default function ScrapePage() {
  const [cfg, setCfg] = useState<ScrapeConfig | null>(null);
  const [maxAreas, setMaxAreas] = useState("");
  const [importAfter, setImportAfter] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  /** 実行中のストリーミングログ */
  const [liveStdout, setLiveStdout] = useState("");
  const [liveStderr, setLiveStderr] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!running) return;
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveStdout, liveStderr, running]);

  async function runScrape() {
    setResult(null);
    setLiveStdout("");
    setLiveStderr("");
    setRunning(true);

    const body: { maxAreas?: number; importAfter: boolean } = {
      importAfter,
    };
    const n = parseInt(maxAreas, 10);
    if (!Number.isNaN(n) && n > 0) body.maxAreas = n;

    let finalResult: ScrapeResult = {
      ok: false,
      exitCode: null,
      durationMs: 0,
    };
    let accOut = "";
    let accErr = "";

    try {
      const r = await fetch("/api/scrape/run/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok || !r.body) {
        const errText = await r.text();
        let msg = `HTTP ${r.status}`;
        try {
          const line = errText.split("\n").find(Boolean);
          if (line) msg = (JSON.parse(line) as { message?: string }).message ?? msg;
        } catch {
          if (errText) msg = errText.slice(0, 200);
        }
        setResult({
          ok: false,
          exitCode: null,
          durationMs: 0,
          error: msg,
        });
        setRunning(false);
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }

          const type = msg.type as string;
          if (type === "log") {
            const stream = msg.stream as string;
            const text = String(msg.text ?? "");
            if (stream === "stderr") {
              accErr += text;
              setLiveStderr(accErr);
            } else {
              accOut += text;
              setLiveStdout(accOut);
            }
          } else if (type === "scrape_done") {
            finalResult = {
              ...finalResult,
              exitCode: msg.exitCode as number | null,
              durationMs: Number(msg.durationMs ?? 0),
              ok: (msg.exitCode as number | null) === 0,
            };
          } else if (type === "import_done") {
            finalResult = {
              ...finalResult,
              import: {
                upserted: Number(msg.upserted),
                modified: Number(msg.modified),
                rowCount: Number(msg.rowCount),
                runId: String(msg.runId),
              },
            };
          } else if (type === "error") {
            finalResult = {
              ...finalResult,
              error: [finalResult.error, String(msg.message ?? "")]
                .filter(Boolean)
                .join("\n"),
              ok: false,
            };
          } else if (type === "complete") {
            finalResult = {
              ...finalResult,
              ok: Boolean(msg.ok),
            };
          }
        }
      }

      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer) as Record<string, unknown>;
          if (msg.type === "complete") {
            finalResult = { ...finalResult, ok: Boolean(msg.ok) };
          }
        } catch {
          /* ignore */
        }
      }

      setResult({
        ...finalResult,
        stdout: accOut,
        stderr: accErr,
      });
    } catch (e) {
      setResult({
        ok: false,
        exitCode: null,
        durationMs: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
    }
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
        <p className="text-sm text-sumi/80">
          実行中は Python の標準出力・標準エラーをリアルタイムで表示します。
        </p>
      </header>

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
            成功後に出力 CSV をデータベースに取り込む
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
            <ProgressBar
              indeterminate
              label="実行中（ログは下に逐次表示されます）"
            />
            <LoadingSpinner size="sm" />
          </div>
        ) : null}
      </form>

      {(running || liveStdout || liveStderr) ? (
        <div className="overflow-hidden rounded-xl border border-wash bg-stone-900/95 shadow-card">
          <p className="border-b border-stone-700 px-3 py-2 text-xs font-medium text-stone-400">
            ログ（リアルタイム）
          </p>
          <pre className="max-h-[min(60vh,28rem)] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-stone-100 whitespace-pre-wrap break-words">
            {liveStderr ? (
              <span className="text-amber-200/95">{liveStderr}</span>
            ) : null}
            {liveStdout ? (
              <span className="text-stone-100">{liveStdout}</span>
            ) : null}
            {!liveStdout && !liveStderr && running ? (
              <span className="text-stone-500">出力を待っています…</span>
            ) : null}
            <div ref={logEndRef} />
          </pre>
        </div>
      ) : null}

      {result && !running ? (
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
            {result.error ? <p className="mt-1 whitespace-pre-wrap">{result.error}</p> : null}
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
                ログ（完了時スナップショット）
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
