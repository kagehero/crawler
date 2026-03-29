"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui";
import {
  filterParamsToSearchParams,
  jobsQueryToSearchParams,
  parseJobsSearchParams,
  type ParsedJobsQuery,
} from "@/lib/jobs-query";
import { formatSalaryRange, sourceLabel } from "@/lib/format-job";

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

type FilterOptions = {
  prefectures: string[];
  sources: string[];
  employmentTypes: string[];
};

function parsedFromUrl(sp: URLSearchParams): ParsedJobsQuery {
  return parseJobsSearchParams(sp);
}

export function JobsExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsedFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const exportHref = useMemo(() => {
    const qs = filterParamsToSearchParams(parsed).toString();
    return `/api/jobs/export${qs ? `?${qs}` : ""}`;
  }, [parsed]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = jobsQueryToSearchParams(parsed);
    const r = await fetch(`/api/jobs?${q.toString()}`, {
      credentials: "include",
    });
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const data = await r.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
    setLoading(false);
  }, [parsed]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(id);
  }, [load]);

  useEffect(() => {
    fetch("/api/jobs/filters", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setOptions(d);
      })
      .catch(() => setOptions(null));
  }, []);

  function applyFromForm(form: FormData) {
    const get = (k: string) => (form.get(k) as string)?.trim() ?? "";
    const limit = Math.min(
      100,
      Math.max(1, parseInt(get("limit") || "25", 10) || 25)
    );
    const sortRaw = get("sort");
    const sort: ParsedJobsQuery["sort"] =
      sortRaw === "salary_high" ||
      sortRaw === "salary_low" ||
      sortRaw === "name_asc"
        ? sortRaw
        : "imported_desc";
    const src = get("source");
    const source =
      src === "job_medley" || src === "wellme" || src === "unknown"
        ? src
        : undefined;

    let salaryGte: number | undefined;
    let salaryLte: number | undefined;
    const sg = get("salaryGte");
    const sl = get("salaryLte");
    if (sg !== "") {
      const n = Number(sg);
      if (Number.isFinite(n)) salaryGte = n;
    }
    if (sl !== "") {
      const n = Number(sl);
      if (Number.isFinite(n)) salaryLte = n;
    }

    const merged: ParsedJobsQuery = {
      page: 1,
      limit,
      q: get("q") || undefined,
      prefecture: get("prefecture") || undefined,
      city: get("city") || undefined,
      source,
      employment: get("employment") || undefined,
      jobCategory: get("jobCategory") || undefined,
      salaryGte,
      salaryLte,
      sort,
    };
    router.push(`/jobs?${jobsQueryToSearchParams(merged).toString()}`);
  }

  function clearFilters() {
    router.push("/jobs");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          求人一覧
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-sumi/80">
          保存されている求人を、キーワードや勤務地・年収などで絞り込めます。
          条件を変えたあと「
          <span className="font-medium text-ink">この条件で表示</span>
          」を押してください。CSV
          は、今表示しているのと同じ条件でダウンロードされます。
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-wash bg-white shadow-card">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink sm:px-6 sm:py-4"
          aria-expanded={filtersOpen}
        >
          <span>検索・絞り込み</span>
          <span className="text-sumi/60">{filtersOpen ? "閉じる" : "開く"}</span>
        </button>
        {filtersOpen && (
          <form
            key={searchParams.toString()}
            className="space-y-4 border-t border-wash bg-paper/40 px-4 py-4 sm:px-6 sm:py-5"
            onSubmit={(e) => {
              e.preventDefault();
              applyFromForm(new FormData(e.currentTarget));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  キーワード
                </span>
                <span className="text-[11px] text-sumi/60">
                  施設名・職種・市区町村など
                </span>
                <input
                  name="q"
                  defaultValue={parsed.q ?? ""}
                  placeholder="例：介護福祉士、渋谷区"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  都道府県
                </span>
                <select
                  name="prefecture"
                  defaultValue={parsed.prefecture ?? ""}
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                >
                  <option value="">すべて</option>
                  {(options?.prefectures ?? []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  市区町村
                </span>
                <input
                  name="city"
                  defaultValue={parsed.city ?? ""}
                  placeholder="例：〇〇市"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  データの出所
                </span>
                <select
                  name="source"
                  defaultValue={parsed.source ?? ""}
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                >
                  <option value="">すべて</option>
                  <option value="job_medley">{sourceLabel("job_medley")}</option>
                  <option value="wellme">{sourceLabel("wellme")}</option>
                  <option value="unknown">{sourceLabel("unknown")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  雇用形態
                </span>
                <input
                  name="employment"
                  list="employment-suggestions"
                  defaultValue={parsed.employment ?? ""}
                  placeholder="例：正社員（候補から選ぶか入力）"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
                <datalist id="employment-suggestions">
                  {(options?.employmentTypes ?? []).map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  職種・カテゴリ
                </span>
                <input
                  name="jobCategory"
                  defaultValue={parsed.jobCategory ?? ""}
                  placeholder="例：介護職"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  年収の下限（万円）
                </span>
                <span className="text-[11px] text-sumi/60">
                  表示される求人の「上限年収」がこの値以上
                </span>
                <input
                  name="salaryGte"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={
                    parsed.salaryGte !== undefined ? String(parsed.salaryGte) : ""
                  }
                  placeholder="例：300"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  年収の上限（万円）
                </span>
                <span className="text-[11px] text-sumi/60">
                  求人の「上限年収」がこの値以下（万円）
                </span>
                <input
                  name="salaryLte"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={
                    parsed.salaryLte !== undefined ? String(parsed.salaryLte) : ""
                  }
                  placeholder="例：500"
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  並び順
                </span>
                <select
                  name="sort"
                  defaultValue={parsed.sort}
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                >
                  <option value="imported_desc">取り込みが新しい順</option>
                  <option value="salary_high">年収の高い順</option>
                  <option value="salary_low">年収の低い順</option>
                  <option value="name_asc">施設名（あいうえお順）</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sumi/90">
                  1ページの件数
                </span>
                <select
                  name="limit"
                  defaultValue={String(parsed.limit)}
                  className="rounded-xl border border-wash bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                >
                  <option value="25">25件</option>
                  <option value="50">50件</option>
                  <option value="100">100件</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-ai px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-aiMuted"
              >
                この条件で表示
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-wash bg-white px-4 py-2.5 text-sm font-medium text-sumi transition hover:bg-wash"
              >
                条件をクリア
              </button>
              <a
                href={exportHref}
                className="inline-flex items-center rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
              >
                CSV をダウンロード
              </a>
            </div>
            <p className="text-[11px] leading-relaxed text-sumi/65">
              CSV は最大 5
              万件まで、現在の絞り込み条件と並び順で出力します（Excel
              向け）。年収はデータが「万円」の場合の目安です。
            </p>
          </form>
        )}
      </section>

      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="text-sumi/80">
          <span className="font-semibold tabular-nums text-ink">
            {total.toLocaleString("ja-JP")}
          </span>
          件が該当しました（{parsed.page} / {pages} ページ）
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-wash bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-stone-100/95 text-xs font-semibold uppercase tracking-wide text-sumi/75 backdrop-blur-sm">
              <tr className="border-b border-wash">
                <th className="whitespace-nowrap px-3 py-3">施設・求人</th>
                <th className="whitespace-nowrap px-3 py-3">勤務地</th>
                <th className="whitespace-nowrap px-3 py-3">職種</th>
                <th className="whitespace-nowrap px-3 py-3">雇用</th>
                <th className="whitespace-nowrap px-3 py-3">年収（目安）</th>
                <th className="whitespace-nowrap px-3 py-3">出所</th>
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
                  <td colSpan={6} className="px-4 py-12 text-center text-sumi/65">
                    条件に合う求人がありません。キーワードや絞り込みを変えてみてください。
                  </td>
                </tr>
              ) : (
                items.map((j, idx) => (
                  <tr
                    key={j._id}
                    className={`border-b border-wash/70 last:border-0 ${
                      idx % 2 === 1 ? "bg-paper/50" : "bg-white"
                    }`}
                  >
                    <td className="max-w-[240px] px-3 py-3 align-top">
                      <span className="line-clamp-2 font-medium text-ink">
                        {j.facility_name || "（名称なし）"}
                      </span>
                      {j.job_url && (
                        <a
                          href={j.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-ai underline-offset-2 hover:underline"
                        >
                          求人ページを開く
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sumi">
                      <div>{j.prefecture || "—"}</div>
                      <div className="text-xs text-sumi/70">{j.city || ""}</div>
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-sumi">
                      <div className="line-clamp-2">{j.job_category || "—"}</div>
                      <div className="line-clamp-1 text-xs text-sumi/65">
                        {j.job_type}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sumi">
                      {j.employment_type || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-sumi">
                      {formatSalaryRange(
                        j.salary_min ?? 0,
                        j.salary_max ?? 0
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-sumi/80">
                      {sourceLabel(j.source)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-wash bg-white px-4 py-3 shadow-sm"
        aria-label="ページ送り"
      >
        <span className="text-sm text-sumi">
          ページ{" "}
          <span className="font-semibold tabular-nums text-ink">
            {parsed.page}
          </span>{" "}
          / {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={parsed.page <= 1}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, {
                page: Math.max(1, parsed.page - 1),
              });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-xl border border-wash bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40"
          >
            前のページ
          </button>
          <button
            type="button"
            disabled={parsed.page >= pages}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, {
                page: parsed.page + 1,
              });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-xl border border-wash bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40"
          >
            次のページ
          </button>
        </div>
      </nav>
    </div>
  );
}
