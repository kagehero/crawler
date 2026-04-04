import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { verifyAdminOrBearer } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { importJobsFromCsvBuffer } from "@/lib/import-csv";
import {
  isCrawlerBundlePresent,
  resolveScraperOutputCsvPath,
  runScraperWithStream,
} from "@/lib/run-scraper";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  maxAreas?: number;
  importAfter?: boolean;
};

type NdjsonEvent =
  | { type: "log"; stream: "stdout" | "stderr"; text: string }
  | {
      type: "scrape_done";
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      durationMs: number;
    }
  | {
      type: "import_done";
      upserted: number;
      modified: number;
      rowCount: number;
      runId: string;
    }
  | { type: "error"; message: string }
  | { type: "complete"; ok: boolean };

function ndjsonLine(obj: NdjsonEvent): string {
  return JSON.stringify(obj) + "\n";
}

/**
 * スクレイパーを実行し、ログを NDJSON でストリーミング返却する。
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminOrBearer(request)) {
    return new Response(JSON.stringify({ type: "error", message: "認証が必要です" }) + "\n", {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  if (!isCrawlerBundlePresent()) {
    return new Response(
      JSON.stringify({
        type: "error",
        message:
          "crawler/main.py がありません。npm run dev はリポジトリルートで実行してください。",
      }) + "\n",
      { status: 503, headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } }
    );
  }

  let body: Body = {};
  try {
    const t = await request.text();
    if (t) body = JSON.parse(t) as Body;
  } catch {
    return new Response(JSON.stringify({ type: "error", message: "JSON ボディが不正です" }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const maxAreas =
    typeof body.maxAreas === "number" && body.maxAreas > 0
      ? Math.min(500, Math.floor(body.maxAreas))
      : undefined;
  const importAfter = Boolean(body.importAfter);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: NdjsonEvent) => {
        controller.enqueue(encoder.encode(ndjsonLine(ev)));
      };

      try {
        const result = await runScraperWithStream({ maxAreas }, (part) => {
          send({ type: "log", stream: part.stream, text: part.text });
        });

        send({
          type: "scrape_done",
          exitCode: result.exitCode,
          signal: result.signal,
          durationMs: result.durationMs,
        });

        if (importAfter && result.exitCode === 0) {
          try {
            const csvPath = resolveScraperOutputCsvPath();
            const buffer = await readFile(csvPath);
            const db = await getDb();
            const importResult = await importJobsFromCsvBuffer(buffer, db, {
              trigger: "scrape",
            });
            send({
              type: "import_done",
              upserted: importResult.upserted,
              modified: importResult.modified,
              rowCount: importResult.rowCount,
              runId: importResult.runId,
            });
          } catch (ie) {
            const msg = ie instanceof Error ? ie.message : String(ie);
            send({ type: "error", message: `CSV 取り込み: ${msg}` });
          }
        }

        send({ type: "complete", ok: result.exitCode === 0 });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        send({ type: "error", message });
        send({ type: "complete", ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
