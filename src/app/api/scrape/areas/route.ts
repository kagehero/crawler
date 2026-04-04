import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrBearer } from "@/lib/auth";
import { isCrawlerBundlePresent } from "@/lib/run-scraper";
import {
  isAllowedScrapeInputFile,
  loadSiteUrlAreasFromCrawler,
  SCRAPE_INPUT_FILES,
  type SiteUrlAreaRow,
} from "@/lib/site-url-areas";

export const runtime = "nodejs";

/**
 * 入力 TSV の地域一覧（Python の load 後と同じ index）。
 * GET ?inputFile=site_url_jobmedley_raks
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminOrBearer(request)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!isCrawlerBundlePresent()) {
    return NextResponse.json(
      { error: "crawler/main.py がありません。" },
      { status: 503 }
    );
  }

  const inputFile = request.nextUrl.searchParams.get("inputFile")?.trim() ?? "";
  if (!inputFile || !isAllowedScrapeInputFile(inputFile)) {
    return NextResponse.json(
      {
        error: "inputFile が不正です",
        allowed: [...SCRAPE_INPUT_FILES],
      },
      { status: 400 }
    );
  }

  try {
    const areas: SiteUrlAreaRow[] = await loadSiteUrlAreasFromCrawler(inputFile);
    return NextResponse.json({ inputFile, areas });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
