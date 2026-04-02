"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui";
import {
  filterParamsToSearchParams,
  JOBS_PAGE_LIMIT_OPTIONS,
  JOBS_PAGE_SIZE,
  jobsQueryToSearchParams,
  parseJobsSearchParams,
  PAYMENT_TYPE_OPTIONS,
  type ParsedJobsQuery,
  type PaymentTypeOption,
} from "@/lib/jobs-query";
import {
  formatPaymentMethodForList,
  formatSalaryRangeForList,
  sourceLabel,
} from "@/lib/format-job";
import {
  TARGET_REGIONS,
  citiesForTargetPrefecture,
  targetPrefectureLabels,
} from "@/lib/target-regions";

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
  payment_method?: string;
  service_type?: string;
  job_url?: string;
  source?: string;
};

type SourceKey = "job_medley" | "wellme" | "unknown";

type FilterOptions = {
  prefectures: string[];
  sources: string[];
  employmentTypes: string[];
  jobCategoriesBySource: Record<SourceKey, string[]>;
  serviceTypesBySource: Record<SourceKey, string[]>;
};

function mergeBySourceLists(
  bySource: Record<SourceKey, string[]> | undefined,
  selectedSource: string | undefined
): string[] {
  if (!bySource) return [];
  if (selectedSource && (selectedSource === "job_medley" || selectedSource === "wellme" || selectedSource === "unknown")) {
    return bySource[selectedSource] ?? [];
  }
  const set = new Set<string>();
  for (const k of ["job_medley", "wellme", "unknown"] as const) {
    (bySource[k] ?? []).forEach((x) => set.add(x));
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

function parsedFromUrl(sp: URLSearchParams): ParsedJobsQuery {
  return parseJobsSearchParams(sp);
}

/** 詳細条件の各項目：最小幅を確保しつつ親幅に合わせて折り返す */
const FILTER_FIELD_GRID =
  "grid gap-x-3 gap-y-2 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]";

const FILTER_INPUT_DEBOUNCE_MS = 420;
const KEYWORD_DEBOUNCE_MS = 450;

/** 多ページ時は両端＋現在付近を表示し、飛びは … で示す */
function getPaginationItems(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total < 1) return [];
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const want = new Set<number>([
    1,
    total,
    current,
    current - 1,
    current + 1,
  ]);
  const sorted = [...want]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

export function JobsExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsedFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  /** 詳細フィルタ欄の開閉（キーワード検索は常に表示） */
  const [filtersOpen, setFiltersOpen] = useState(true);

  const exportHref = useMemo(() => {
    const qs = filterParamsToSearchParams(parsed).toString();
    return `/api/jobs/export${qs ? `?${qs}` : ""}`;
  }, [parsed]);

  /** 都道府県: target-regions のみ */
  const prefectureOptions = useMemo(() => targetPrefectureLabels(), []);

  const paginationItems = useMemo(
    () => getPaginationItems(parsed.page, pages),
    [parsed.page, pages]
  );

  /** 市区町村: target-regions のプルダウン（都道府県未選択時は空） */
  const cityOptions = useMemo(() => {
    if (!parsed.prefecture) return [];
    return citiesForTargetPrefecture(parsed.prefecture);
  }, [parsed.prefecture]);

  const jobCategoryOptions = useMemo(
    () => mergeBySourceLists(options?.jobCategoriesBySource, parsed.source),
    [options?.jobCategoriesBySource, parsed.source]
  );

  const serviceTypeOptions = useMemo(
    () => mergeBySourceLists(options?.serviceTypesBySource, parsed.source),
    [options?.serviceTypesBySource, parsed.source]
  );

  /** DB の distinct に無い値（旧 URL 等）も選択肢に含める */
  const employmentOptions = useMemo(() => {
    const base = options?.employmentTypes ?? [];
    if (!parsed.employment) return base;
    if (base.includes(parsed.employment)) return base;
    return [...base, parsed.employment].sort((a, b) =>
      a.localeCompare(b, "ja")
    );
  }, [options?.employmentTypes, parsed.employment]);

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

  const filterFormRef = useRef<HTMLFormElement>(null);
  const filterApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const keywordFormRef = useRef<HTMLFormElement>(null);
  const keywordApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /** 詳細フィルタ（キーワード・件数は URL のまま） */
  const applyFilterForm = useCallback(
    (form: FormData) => {
      const get = (k: string) => (form.get(k) as string)?.trim() ?? "";
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

      const paymentRaw = get("paymentType");
      const paymentType = (PAYMENT_TYPE_OPTIONS as readonly string[]).includes(
        paymentRaw
      )
        ? (paymentRaw as PaymentTypeOption)
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

      const p = parsedRef.current;
      const newPrefecture = get("prefecture") || undefined;
      const prefectureChanged = newPrefecture !== p.prefecture;
      const sourceChanged = source !== p.source;
      const merged: ParsedJobsQuery = {
        page: 1,
        limit: p.limit,
        q: p.q,
        prefecture: newPrefecture,
        city: prefectureChanged ? undefined : get("city") || undefined,
        source,
        employment: get("employment") || undefined,
        jobCategory: sourceChanged ? undefined : get("jobCategory") || undefined,
        serviceType: sourceChanged ? undefined : get("serviceType") || undefined,
        paymentType,
        salaryGte,
        salaryLte,
        sort,
      };
      router.push(`/jobs?${jobsQueryToSearchParams(merged).toString()}`);
    },
    [router]
  );

  const scheduleFilterApply = useCallback(
    (immediate: boolean) => {
      if (filterApplyTimerRef.current) {
        clearTimeout(filterApplyTimerRef.current);
        filterApplyTimerRef.current = null;
      }
      const run = () => {
        const f = filterFormRef.current;
        if (f) applyFilterForm(new FormData(f));
      };
      if (immediate) run();
      else {
        filterApplyTimerRef.current = setTimeout(() => {
          filterApplyTimerRef.current = null;
          run();
        }, FILTER_INPUT_DEBOUNCE_MS);
      }
    },
    [applyFilterForm]
  );

  const handleFilterFormChange = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLSelectElement) {
        scheduleFilterApply(true);
        return;
      }
      if (t instanceof HTMLInputElement) {
        scheduleFilterApply(false);
      }
    },
    [scheduleFilterApply]
  );

  const applyKeywordFromForm = useCallback(() => {
    const f = keywordFormRef.current;
    if (!f) return;
    const fd = new FormData(f);
    const raw = (fd.get("q") as string)?.trim() ?? "";
    const p = parsedRef.current;
    const merged: ParsedJobsQuery = {
      ...p,
      page: 1,
      q: raw || undefined,
    };
    router.push(`/jobs?${jobsQueryToSearchParams(merged).toString()}`);
  }, [router]);

  const scheduleKeywordApply = useCallback(() => {
    if (keywordApplyTimerRef.current) {
      clearTimeout(keywordApplyTimerRef.current);
      keywordApplyTimerRef.current = null;
    }
    keywordApplyTimerRef.current = setTimeout(() => {
      keywordApplyTimerRef.current = null;
      applyKeywordFromForm();
    }, KEYWORD_DEBOUNCE_MS);
  }, [applyKeywordFromForm]);

  useEffect(() => {
    return () => {
      if (filterApplyTimerRef.current) {
        clearTimeout(filterApplyTimerRef.current);
      }
      if (keywordApplyTimerRef.current) {
        clearTimeout(keywordApplyTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3 sm:space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
          求人一覧
        </h1>
        <p className="max-w-3xl text-[11px] leading-snug text-sumi/75">
          キーワード・詳細条件を変えると一覧が自動で更新されます。CSV
          は結果の上にあるリンクから、現在の条件でダウンロードできます。
        </p>
      </header>

      <div
        className="flex max-h-[50vh] flex-col overflow-hidden rounded-2xl border border-wash bg-white shadow-card"
        aria-label="検索・絞り込み"
      >
        <section
          className="shrink-0 border-b border-wash/80 bg-white px-3 py-2 sm:px-4"
          aria-labelledby="jobs-keyword-heading"
        >
          <h2
            id="jobs-keyword-heading"
            className="text-[11px] font-semibold uppercase tracking-wide text-sumi/80"
          >
            キーワード
          </h2>
          <form
            ref={keywordFormRef}
            key={`kw-${searchParams.toString()}`}
            className="mt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (keywordApplyTimerRef.current) {
                clearTimeout(keywordApplyTimerRef.current);
                keywordApplyTimerRef.current = null;
              }
              applyKeywordFromForm();
            }}
          >
            <label className="block min-w-0">
              <span className="sr-only">キーワード</span>
              <input
                name="q"
                defaultValue={parsed.q ?? ""}
                placeholder="施設名・職種・市区町村など（入力後しばらくで反映）"
                autoComplete="off"
                onChange={scheduleKeywordApply}
                className="w-full rounded-lg border border-wash bg-paper/50 px-2.5 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
              />
            </label>
          </form>
        </section>

        <div
          className={
            filtersOpen
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-paper/25"
              : "shrink-0 bg-paper/25"
          }
        >
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full shrink-0 items-center justify-between px-3 py-2 text-left text-xs font-semibold text-ink sm:px-4"
            aria-expanded={filtersOpen}
            id="jobs-filters-toggle"
          >
            <span>詳細条件</span>
            <span className="font-normal text-sumi/60">
              {filtersOpen ? "閉じる" : "開く"}
            </span>
          </button>
          {filtersOpen && (
            <form
              ref={filterFormRef}
              key={`flt-${searchParams.toString()}`}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-0.5 sm:px-4"
              onSubmit={(e) => e.preventDefault()}
              onChange={handleFilterFormChange}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              <fieldset className="min-h-0 rounded-lg border border-ai/25 bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  勤務地
                </legend>
                <p className="mb-1.5 text-[10px] leading-snug text-sumi/70">
                  候補は取得対象エリアに合わせています。
                </p>
                <div className={FILTER_FIELD_GRID}>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      都道府県
                    </span>
                    <select
                      name="prefecture"
                      defaultValue={parsed.prefecture ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      {prefectureOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      市区町村
                    </span>
                    <select
                      name="city"
                      defaultValue={parsed.city ?? ""}
                      disabled={!parsed.prefecture}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2 disabled:cursor-not-allowed disabled:bg-wash/60"
                    >
                      <option value="">
                        {parsed.prefecture ? "すべて" : "先に都道府県を選択"}
                      </option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details className="mt-2 rounded-md border border-wash/90 bg-paper/50">
                  <summary className="cursor-pointer px-2 py-1.5 text-[10px] font-medium text-sumi/90">
                    対象市区町村（参考）
                  </summary>
                  <ul className="max-h-24 space-y-1 overflow-y-auto border-t border-wash/80 px-2 py-1.5 text-[10px] leading-tight text-sumi/85">
                    {TARGET_REGIONS.map((r) => (
                      <li key={r.prefecture}>
                        <span className="font-semibold text-ink">
                          {r.prefecture}
                        </span>
                        <span className="text-sumi/50"> — </span>
                        {r.cities.join("、")}
                      </li>
                    ))}
                  </ul>
                </details>
              </fieldset>

              <fieldset className="rounded-lg border border-wash bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  求人の条件
                </legend>
                <div className={`mt-0.5 ${FILTER_FIELD_GRID}`}>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      媒体名
                    </span>
                    <select
                      name="source"
                      defaultValue={parsed.source ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      <option value="job_medley">
                        {sourceLabel("job_medley")}
                      </option>
                      <option value="wellme">{sourceLabel("wellme")}</option>
                      <option value="unknown">{sourceLabel("unknown")}</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      雇用形態
                    </span>
                    <select
                      name="employment"
                      defaultValue={parsed.employment ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      {employmentOptions.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      職種（job_category）
                    </span>
                    <select
                      name="jobCategory"
                      defaultValue={parsed.jobCategory ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      {jobCategoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      サービス種別
                    </span>
                    <select
                      name="serviceType"
                      defaultValue={parsed.serviceType ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      {serviceTypeOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="min-h-0 rounded-lg border border-wash bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  給与（CSV の支給区分・金額）
                </legend>
                <p className="mb-1.5 text-[10px] leading-snug text-sumi/70">
                  月給・時給・日給で絞り込みます。金額は DB
                  の数値に合わせた目安です。
                </p>
                <div className={`mt-0.5 ${FILTER_FIELD_GRID}`}>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      支給区分
                    </span>
                    <select
                      name="paymentType"
                      defaultValue={parsed.paymentType ?? ""}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="">すべて</option>
                      {PAYMENT_TYPE_OPTIONS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      下限（万円目安）
                    </span>
                    <input
                      name="salaryGte"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={
                        parsed.salaryGte !== undefined
                          ? String(parsed.salaryGte)
                          : ""
                      }
                      placeholder="例：300"
                      title="salary_max がこの値以上の求人"
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      上限（万円目安）
                    </span>
                    <input
                      name="salaryLte"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={
                        parsed.salaryLte !== undefined
                          ? String(parsed.salaryLte)
                          : ""
                      }
                      placeholder="例：500"
                      title="salary_min がこの値以下の求人"
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="min-h-0 rounded-lg border border-wash bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  一覧の表示
                </legend>
                <div className="mt-0.5 max-w-md">
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      並び順
                    </span>
                    <select
                      name="sort"
                      defaultValue={parsed.sort}
                      className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                    >
                      <option value="imported_desc">取り込みが新しい順</option>
                      <option value="salary_high">給与の高い順</option>
                      <option value="salary_low">給与の低い順</option>
                      <option value="name_asc">施設名（あいうえお順）</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-sumi/80">
          <span className="font-semibold tabular-nums text-ink">
            {total.toLocaleString("ja-JP")}
          </span>
          件が該当しました（{parsed.page} / {pages} ページ）
        </p>
        <a
          href={exportHref}
          title="最大5万件まで。現在のキーワード・詳細条件を反映します。"
          className="inline-flex shrink-0 items-center rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
        >
          CSV をダウンロード
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-wash bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-stone-100/95 text-xs font-semibold uppercase tracking-wide text-sumi/75 backdrop-blur-sm">
              <tr className="border-b border-wash">
                <th className="whitespace-nowrap px-3 py-3">施設・求人</th>
                <th className="whitespace-nowrap px-3 py-3">勤務地</th>
                <th className="whitespace-nowrap px-3 py-3">職種</th>
                <th className="whitespace-nowrap px-3 py-3">雇用</th>
                <th className="whitespace-nowrap px-3 py-3">給与</th>
                <th className="whitespace-nowrap px-3 py-3">支給</th>
                <th className="whitespace-nowrap px-3 py-3">サービス</th>
                <th className="whitespace-nowrap px-3 py-3">媒体</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14">
                    <div className="flex justify-center">
                      <LoadingSpinner size="md" label="読み込み中…" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sumi/65">
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
                      {formatSalaryRangeForList(
                        j.payment_method,
                        j.salary_min ?? 0,
                        j.salary_max ?? 0
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-sumi">
                      {formatPaymentMethodForList(j.payment_method)}
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-xs text-sumi">
                      <span className="line-clamp-2">{j.service_type || "—"}</span>
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
        className="flex flex-col gap-4 rounded-2xl border border-wash bg-white px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        aria-label="ページ送り"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <span className="text-sm text-sumi">
            ページ{" "}
            <span className="font-semibold tabular-nums text-ink">
              {parsed.page}
            </span>{" "}
            / {pages}
          </span>
          <label className="flex flex-wrap items-center gap-1.5 text-sm text-sumi">
            <span className="whitespace-nowrap">1ページの件数</span>
            <select
              value={parsed.limit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                const limit = (
                  JOBS_PAGE_LIMIT_OPTIONS as readonly number[]
                ).includes(v)
                  ? v
                  : JOBS_PAGE_SIZE;
                const sp = jobsQueryToSearchParams(parsed, {
                  limit,
                  page: 1,
                });
                router.push(`/jobs?${sp.toString()}`);
              }}
              className="rounded-lg border border-wash bg-white px-2 py-1 text-xs font-medium text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
              aria-label="1ページあたりの表示件数"
            >
              {JOBS_PAGE_LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}件
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
          <button
            type="button"
            disabled={parsed.page <= 1}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, { page: 1 });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-lg border border-wash bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            最初
          </button>
          <button
            type="button"
            disabled={parsed.page <= 1}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, {
                page: Math.max(1, parsed.page - 1),
              });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-lg border border-wash bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            前へ
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {paginationItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`e-${idx}`}
                  className="px-1 text-sm text-sumi/70"
                  aria-hidden
                >
                  …
                </span>
              ) : item === parsed.page ? (
                <span
                  key={item}
                  className="min-w-[2.25rem] rounded-lg border border-ai bg-ai px-2 py-1.5 text-center text-sm font-medium tabular-nums text-white shadow-sm sm:min-w-[2.5rem]"
                  aria-current="page"
                >
                  {item}
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    const sp = jobsQueryToSearchParams(parsed, { page: item });
                    router.push(`/jobs?${sp.toString()}`);
                  }}
                  className="min-w-[2.25rem] rounded-lg border border-wash bg-white px-2 py-1.5 text-sm font-medium tabular-nums text-ink shadow-sm transition hover:bg-wash sm:min-w-[2.5rem]"
                >
                  {item}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            disabled={parsed.page >= pages}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, {
                page: parsed.page + 1,
              });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-lg border border-wash bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            次へ
          </button>
          <button
            type="button"
            disabled={parsed.page >= pages}
            onClick={() => {
              const sp = jobsQueryToSearchParams(parsed, { page: pages });
              router.push(`/jobs?${sp.toString()}`);
            }}
            className="rounded-lg border border-wash bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            最後
          </button>
        </div>
      </nav>
    </div>
  );
}
