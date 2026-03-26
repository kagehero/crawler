import { existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";

export type RunScraperOptions = {
  /** テスト用: 先頭 N 地域のみ */
  maxAreas?: number;
};

export type RunScraperResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

/**
 * Python スクレイパーのルートディレクトリ（リポジトリ直下の `crawler/`）。
 * 上書きしたい場合のみ SCRAPER_ROOT を設定。
 */
export function getCrawlerRoot(): string {
  if (process.env.SCRAPER_ROOT) {
    return path.resolve(process.env.SCRAPER_ROOT);
  }
  return path.resolve(process.cwd(), "crawler");
}

export function isCrawlerBundlePresent(): boolean {
  const root = getCrawlerRoot();
  return existsSync(path.join(root, "main.py"));
}

/**
 * `crawler/` で `python main.py` を実行する。
 */
export async function runScraper(
  opts: RunScraperOptions = {}
): Promise<RunScraperResult> {
  const root = getCrawlerRoot();
  if (!existsSync(path.join(root, "main.py"))) {
    throw new Error(
      `スクレイパーが見つかりません: ${path.join(root, "main.py")}（npm run dev はリポジトリルートで実行してください）`
    );
  }

  const python = process.env.SCRAPER_PYTHON || "python3";
  const inputRel = process.env.SCRAPER_INPUT || "site_url_jobmedley_raks";
  const outputRel = process.env.SCRAPER_OUTPUT || "data/output.csv";
  const outputDirRel = process.env.SCRAPER_OUTPUT_DIR || "data/pages";

  const args = [
    "main.py",
    "--input",
    inputRel,
    "--output",
    outputRel,
    "--output-dir",
    outputDirRel,
  ];
  if (opts.maxAreas != null && opts.maxAreas > 0) {
    args.push("--max-areas", String(opts.maxAreas));
  }

  const start = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: root,
      env: { ...process.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code, signal) => {
      resolve({
        exitCode: code,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });
}

/** スクレイプ出力 CSV の絶対パス（取り込み用） */
export function resolveScraperOutputCsvPath(): string {
  const root = getCrawlerRoot();
  const rel = process.env.SCRAPER_OUTPUT || "data/output.csv";
  return path.resolve(root, rel);
}
