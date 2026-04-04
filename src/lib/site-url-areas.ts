import path from "path";
import { readFile } from "fs/promises";
import { getCrawlerRoot } from "@/lib/run-scraper";

/** `crawler/` 直下の入力 TSV（パストラベル防止のためホワイトリスト） */
export const SCRAPE_INPUT_FILES = [
  "site_url_jobmedley_raks",
  "site_url_wellme_raks",
] as const;

export type ScrapeInputFileId = (typeof SCRAPE_INPUT_FILES)[number];

export type SiteUrlAreaRow = {
  index: number;
  prefecture: string;
  city: string;
  url: string;
  scraper: "job_medley" | "wellme";
};

export function isAllowedScrapeInputFile(name: string): name is ScrapeInputFileId {
  const base = path.basename(name.trim());
  return (SCRAPE_INPUT_FILES as readonly string[]).includes(base);
}

export function detectScraperFromUrl(url: string): "job_medley" | "wellme" {
  return url.includes("kaigojob.com") ? "wellme" : "job_medley";
}

/**
 * Python `load_areas_from_site_url_file` と同じ順・同じフィルタで行を構築する。
 * `index` は `--area-indices` に渡す 0 始まり。
 */
export function parseSiteUrlAreasTsv(content: string): SiteUrlAreaRow[] {
  const areas: SiteUrlAreaRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 3) continue;
    const prefecture = parts[0]?.trim() ?? "";
    const city = parts[1]?.trim() ?? "";
    const url = parts[2]?.trim() ?? "";
    if (!prefecture || !city || !url) continue;
    const scraper = detectScraperFromUrl(url);
    if (scraper === "job_medley") {
      if (!/prefecture_id=\d+/.test(url) || !/city_id=\d+/.test(url)) continue;
    }
    areas.push({
      index: areas.length,
      prefecture,
      city,
      url,
      scraper,
    });
  }
  return areas;
}

export async function loadSiteUrlAreasFromCrawler(
  inputFile: ScrapeInputFileId
): Promise<SiteUrlAreaRow[]> {
  const root = getCrawlerRoot();
  const full = path.join(root, inputFile);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("不正な入力パスです");
  }
  const content = await readFile(full, "utf8");
  return parseSiteUrlAreasTsv(content);
}
