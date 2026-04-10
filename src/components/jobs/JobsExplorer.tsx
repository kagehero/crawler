"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
import {
  jobCategoryGroupLabels,
  jobCategoryGroupsConfigured,
} from "@/lib/job-category-groups";

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
  selectedSources: SourceKey[] | undefined
): string[] {
  if (!bySource) return [];
  const keys: SourceKey[] =
    selectedSources && selectedSources.length > 0
      ? selectedSources.filter((k) =>
          k === "job_medley" || k === "wellme" || k === "unknown"
        )
      : (["job_medley", "wellme", "unknown"] as const);
  const set = new Set<string>();
  for (const k of keys) {
    (bySource[k] ?? []).forEach((x) => set.add(x));
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

/** DB の service_type 文字列を「、」等で分割し、1チェックボックス＝1サービス語に正規化して一意化 */
function uniqueServiceTypeTokens(
  bySource: Record<SourceKey, string[]> | undefined,
  selectedSources: SourceKey[] | undefined
): string[] {
  const merged = mergeBySourceLists(bySource, selectedSources);
  const set = new Set<string>();
  for (const raw of merged) {
    const s = raw.trim();
    if (!s) continue;
    for (const part of s.split(/[、,，]/)) {
      const t = part.trim();
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

function citiesForPrefectureList(prefectures: string[]): string[] {
  const set = new Set<string>();
  for (const pr of prefectures) {
    citiesForTargetPrefecture(pr).forEach((c) => set.add(c));
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

/** URL の配列パラメータとフォーム値の比較用 */
function sortedJoin(values: string[] | undefined): string {
  return [...(values ?? [])].sort().join("\0");
}

const SOURCE_KEYS_ALL: SourceKey[] = ["job_medley", "wellme", "unknown"];

/** 現在の選択が候補一覧と一致するか（「全て選択」トグル用） */
function isSelectionAllOf(
  selected: readonly string[] | undefined,
  all: readonly string[]
): boolean {
  if (all.length === 0) return false;
  const s = selected ?? [];
  if (s.length !== all.length) return false;
  return all.every((x) => s.includes(x));
}

function isSourceSelectionAll(
  selected: readonly SourceKey[] | undefined
): boolean {
  return isSelectionAllOf(selected, SOURCE_KEYS_ALL);
}

function parsedFromUrl(sp: URLSearchParams): ParsedJobsQuery {
  return parseJobsSearchParams(sp);
}

/** 検索条件の各項目：最小幅を確保しつつ親幅に合わせて折り返す */
const FILTER_FIELD_GRID =
  "grid gap-x-3 gap-y-2 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]";

/** 複数選択：件数に応じた高さ（最大は max-h、超えたら中だけスクロール）。固定 min-h は付けない（0fr 折りたたみの最小高が膨らむのを防ぐ） */
const FILTER_CHECKBOX_LIST =
  "box-border min-h-0 max-h-36 overflow-y-auto overscroll-contain px-2 py-1.5 text-xs";

/** ドロップダウン用：`group` で矢印回転。`relative`+`open:z-*` で重ね表示のパネルが隣接項目より手前に */
const FILTER_DROPDOWN_DETAILS =
  "group relative z-0 w-full min-w-0 rounded-lg border border-wash bg-white text-xs shadow-sm transition-shadow duration-200 ease-out open:z-30 open:border-ai/35 open:ring-2 open:ring-ai/15";

/** 一覧を並び順の select と同様に「本文の高さに含めない」オーバーレイとして出す */
const FILTER_DROPDOWN_PANEL =
  "absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-wash bg-white shadow-lg";

/** 1 行固定＋長い選択は省略（レイアウトの縦幅を一定に） */
const FILTER_DROPDOWN_SUMMARY =
  "flex h-9 min-h-9 w-full shrink-0 cursor-pointer list-none items-center justify-between gap-2 px-2.5 text-left text-xs text-ink outline-none [&::-webkit-details-marker]:hidden hover:bg-paper/40";

/** オーバーレイ内のチェック一覧ラッパー（高さは件数に応じ max-h まで） */
function CloseDropdownBtn() {
  return (
    <button
      type="button"
      className="ml-auto shrink-0 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold text-ai hover:bg-ai/10 active:scale-95"
      onClick={(e) => {
        const details = (e.currentTarget as HTMLElement).closest("details");
        if (details) details.removeAttribute("open");
      }}
    >
      この条件で設定
    </button>
  );
}

function FilterDropdownPanel({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className={FILTER_DROPDOWN_PANEL}>
      <div
        className="min-h-0 bg-paper/30"
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}

function FilterDropdownChevron() {
  return (
    <span
      className="inline-block shrink-0 text-[10px] text-sumi/55 transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0 group-open:rotate-180"
      aria-hidden
    >
      ▼
    </span>
  );
}

function filterDropdownLabel(
  selected: string[] | undefined,
  placeholder: string
): string {
  if (selected?.length) return selected.join("、");
  return placeholder;
}

const KEYWORD_DEBOUNCE_MS = 450;

const SELECT_ALL_BTN =
  "rounded px-2 py-0.5 text-[10px] font-medium text-ai hover:bg-ai/10";

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
  useLayoutEffect(() => {
    parsedRef.current = parsed;
  }, [parsed]);

  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  /** 検索条件欄の開閉（キーワードは下段に常時表示） */
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

  /** 市区町村: 選択した都道府県の対象市区町村の和集合 */
  const cityOptions = useMemo(() => {
    if (!parsed.prefectures?.length) return [];
    return citiesForPrefectureList(parsed.prefectures);
  }, [parsed.prefectures]);

  const jobCategoryOptions = useMemo(() => {
    if (jobCategoryGroupsConfigured()) return jobCategoryGroupLabels();
    return mergeBySourceLists(options?.jobCategoriesBySource, parsed.sources);
  }, [options?.jobCategoriesBySource, parsed.sources]);

  const serviceTypeOptions = useMemo(() => {
    const base = uniqueServiceTypeTokens(
      options?.serviceTypesBySource,
      parsed.sources
    );
    const extra =
      parsed.serviceTypes?.filter((x) => !base.includes(x)) ?? [];
    if (extra.length === 0) return base;
    return [...new Set([...base, ...extra])].sort((a, b) =>
      a.localeCompare(b, "ja")
    );
  }, [options?.serviceTypesBySource, parsed.sources, parsed.serviceTypes]);

  /** DB の distinct に無い値（旧 URL 等）も選択肢に含める */
  const employmentOptions = useMemo(() => {
    const base = options?.employmentTypes ?? [];
    const extra = parsed.employments?.filter((e) => !base.includes(e)) ?? [];
    if (extra.length === 0) return base;
    return [...base, ...extra].sort((a, b) => a.localeCompare(b, "ja"));
  }, [options?.employmentTypes, parsed.employments]);

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

  const keywordFormRef = useRef<HTMLFormElement>(null);
  const keywordDraftRef = useRef<string>("");
  const [keywordDraft, setKeywordDraft] = useState(() => parsed.q ?? "");
  const keywordApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /* URL の q が外部要因で変わったときだけローカル入力と同期（キーワードはデバウンス送信） */
  useEffect(() => {
    const q = parsed.q ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL と入力欄を同期
    setKeywordDraft(q);
    keywordDraftRef.current = q;
  }, [parsed.q]);

  const filterFormRef = useRef<HTMLFormElement>(null);

  /** URL 同期（フォームの key で再マウントしない → 複数選択ドロップダウンが閉じない） */
  const patchFilter = useCallback(
    (patch: Partial<ParsedJobsQuery>) => {
      const p = parsedRef.current;
      router.push(
        `/jobs?${jobsQueryToSearchParams({ ...p, ...patch, page: 1 }).toString()}`
      );
    },
    [router]
  );

  const togglePrefecture = useCallback(
    (pr: string) => {
      const p = parsedRef.current;
      const cur = p.prefectures ?? [];
      const next = cur.includes(pr)
        ? cur.filter((x) => x !== pr)
        : [...cur, pr];
      const allowed = citiesForPrefectureList(next);
      const cities = (p.cities ?? []).filter((c) => allowed.includes(c));
      patchFilter({
        prefectures: next.length ? next : undefined,
        cities: cities.length ? cities : undefined,
      });
    },
    [patchFilter]
  );

  const toggleCity = useCallback(
    (city: string) => {
      const p = parsedRef.current;
      const cur = p.cities ?? [];
      const next = cur.includes(city)
        ? cur.filter((x) => x !== city)
        : [...cur, city];
      patchFilter({ cities: next.length ? next : undefined });
    },
    [patchFilter]
  );

  const toggleSource = useCallback(
    (key: SourceKey) => {
      const p = parsedRef.current;
      const cur = p.sources ?? [];
      const next = cur.includes(key)
        ? cur.filter((x) => x !== key)
        : [...cur, key];
      const sourceChanged = sortedJoin(next) !== sortedJoin(p.sources);
      patchFilter({
        sources: next.length ? next : undefined,
        jobCategories: sourceChanged ? undefined : p.jobCategories,
        serviceTypes: sourceChanged ? undefined : p.serviceTypes,
      });
    },
    [patchFilter]
  );

  const toggleEmployment = useCallback(
    (e: string) => {
      const p = parsedRef.current;
      const cur = p.employments ?? [];
      const next = cur.includes(e)
        ? cur.filter((x) => x !== e)
        : [...cur, e];
      patchFilter({ employments: next.length ? next : undefined });
    },
    [patchFilter]
  );

  const toggleJobCategory = useCallback(
    (c: string) => {
      const p = parsedRef.current;
      const cur = p.jobCategories ?? [];
      const next = cur.includes(c)
        ? cur.filter((x) => x !== c)
        : [...cur, c];
      patchFilter({ jobCategories: next.length ? next : undefined });
    },
    [patchFilter]
  );

  const toggleServiceType = useCallback(
    (c: string) => {
      const p = parsedRef.current;
      const cur = p.serviceTypes ?? [];
      const next = cur.includes(c)
        ? cur.filter((x) => x !== c)
        : [...cur, c];
      patchFilter({ serviceTypes: next.length ? next : undefined });
    },
    [patchFilter]
  );

  const togglePaymentType = useCallback(
    (pm: PaymentTypeOption) => {
      const p = parsedRef.current;
      const cur = p.paymentTypes ?? [];
      const next = cur.includes(pm)
        ? cur.filter((x) => x !== pm)
        : [...cur, pm];
      patchFilter({
        paymentTypes: next.length ? next : undefined,
      });
    },
    [patchFilter]
  );

  const applySalaryFromForm = useCallback(() => {
    const f = filterFormRef.current;
    if (!f) return;
    const fd = new FormData(f);
    const parseNum = (s: string): number | undefined => {
      const t = s.trim();
      if (t === "") return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    const sg = (fd.get("salaryGte") as string) ?? "";
    const sl = (fd.get("salaryLte") as string) ?? "";
    patchFilter({
      salaryGte: parseNum(sg),
      salaryLte: parseNum(sl),
    });
  }, [patchFilter]);

  const applyKeywordFromForm = useCallback(() => {
    const raw = keywordDraftRef.current.trim();
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
          検索条件選択・フリーワード入力をすると、それに沿った検索結果に自動更新されます。検索結果一覧は【CSVをダウンロード】ボタンよりダウンロードが可能です。
        </p>
      </header>

      <div
        className="flex flex-col rounded-2xl border border-wash bg-white shadow-card"
        aria-label="検索・絞り込み"
      >
        <div
          className={
            filtersOpen ? "flex flex-col bg-paper/25" : "shrink-0 bg-paper/25"
          }
        >
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full shrink-0 items-center justify-between px-3 py-2 text-left text-xs font-semibold text-ink sm:px-4"
            aria-expanded={filtersOpen}
            id="jobs-filters-toggle"
          >
            <span>検索条件</span>
            <span className="font-normal text-sumi/60">
              {filtersOpen ? "閉じる" : "開く"}
            </span>
          </button>
          {filtersOpen && (
            <form
              ref={filterFormRef}
              className="overflow-visible px-3 pb-3 pt-0.5 sm:px-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 sm:items-start">
              <fieldset className="min-h-0 rounded-lg border border-ai/25 bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  勤務地
                </legend>
                <p className="mb-1.5 text-[10px] leading-snug text-sumi/70">
                検索候補は貴社展開エリアに合わせています。以下（参考）を参照下さい。
                </p>
                <div className={FILTER_FIELD_GRID}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      都道府県（複数可）
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.prefectures?.length
                              ? parsed.prefectures.join("、")
                              : undefined
                          }
                        >
                          {parsed.prefectures?.length
                            ? parsed.prefectures.join("、")
                            : "クリックして都道府県を選ぶ"}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="都道府県">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              if (
                                isSelectionAllOf(
                                  parsed.prefectures,
                                  prefectureOptions
                                )
                              ) {
                                patchFilter({
                                  prefectures: undefined,
                                  cities: undefined,
                                });
                              } else {
                                patchFilter({
                                  prefectures: [...prefectureOptions],
                                });
                              }
                            }}
                          >
                            {isSelectionAllOf(
                              parsed.prefectures,
                              prefectureOptions
                            )
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {prefectureOptions.map((pr) => (
                            <label
                              key={pr}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.prefectures?.includes(pr) ?? false
                                }
                                onChange={() => togglePrefecture(pr)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span>{pr}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      市区町村（複数可）
                    </span>
                    {!parsed.prefectures?.length ? (
                      <div
                        className="rounded-lg border border-dashed border-wash bg-wash/40 px-2.5 py-2 text-xs text-sumi/60"
                        role="status"
                      >
                        先に都道府県を選んでください
                      </div>
                    ) : (
                      <details className={FILTER_DROPDOWN_DETAILS}>
                        <summary className={FILTER_DROPDOWN_SUMMARY}>
                          <span
                            className="min-w-0 flex-1 truncate"
                            title={
                              parsed.cities?.length
                                ? parsed.cities.join("、")
                                : undefined
                            }
                          >
                            {parsed.cities?.length
                              ? parsed.cities.join("、")
                              : "クリックして市区町村を選ぶ"}
                          </span>
                          <FilterDropdownChevron />
                        </summary>
                        <FilterDropdownPanel ariaLabel="市区町村">
                          <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                            <button
                              type="button"
                              className={SELECT_ALL_BTN}
                              onClick={() => {
                                if (
                                  isSelectionAllOf(parsed.cities, cityOptions)
                                ) {
                                  patchFilter({ cities: undefined });
                                } else if (cityOptions.length > 0) {
                                  patchFilter({ cities: [...cityOptions] });
                                }
                              }}
                            >
                              {isSelectionAllOf(parsed.cities, cityOptions)
                                ? "全て解除"
                                : "全て選択"}
                            </button>
                            <CloseDropdownBtn />
                          </div>
                          <div className={FILTER_CHECKBOX_LIST}>
                            {cityOptions.map((c) => (
                              <label
                                key={c}
                                className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                              >
                                <input
                                  type="checkbox"
                                  checked={parsed.cities?.includes(c) ?? false}
                                  onChange={() => toggleCity(c)}
                                  className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                                />
                                <span>{c}</span>
                              </label>
                            ))}
                          </div>
                        </FilterDropdownPanel>
                      </details>
                    )}
                  </div>
                </div>
                <details className="group mt-2 rounded-md border border-wash/90 bg-paper/50 transition-shadow duration-200 ease-out open:border-wash">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-[10px] font-medium text-sumi/90 [&::-webkit-details-marker]:hidden">
                    <span>（参考）検索可能・都道府県 / 市区町村</span>
                    <span
                      className="inline-block shrink-0 text-sumi/45 transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-180"
                      aria-hidden
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0 group-open:grid-rows-[1fr]">
                    <div className="min-h-0 overflow-hidden">
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
                    </div>
                  </div>
                </details>
              </fieldset>

              <fieldset className="rounded-lg border border-wash bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  求人の条件
                </legend>
                <div className={`mt-0.5 ${FILTER_FIELD_GRID}`}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      媒体名（複数可）
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.sources?.length
                              ? parsed.sources
                                  .map((k) => sourceLabel(k))
                                  .join("、")
                              : undefined
                          }
                        >
                          {parsed.sources?.length
                            ? parsed.sources
                                .map((k) => sourceLabel(k))
                                .join("、")
                            : "クリックして媒体を選ぶ"}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="媒体名">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              if (isSourceSelectionAll(parsed.sources)) {
                                patchFilter({
                                  sources: undefined,
                                  jobCategories: undefined,
                                  serviceTypes: undefined,
                                });
                              } else {
                                patchFilter({ sources: [...SOURCE_KEYS_ALL] });
                              }
                            }}
                          >
                            {isSourceSelectionAll(parsed.sources)
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {(
                            [
                              ["job_medley", sourceLabel("job_medley")],
                              ["wellme", sourceLabel("wellme")],
                              ["unknown", sourceLabel("unknown")],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.sources?.includes(key) ?? false
                                }
                                onChange={() => toggleSource(key)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      雇用形態（複数可）
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.employments?.length
                              ? parsed.employments.join("、")
                              : undefined
                          }
                        >
                          {filterDropdownLabel(
                            parsed.employments,
                            "クリックして雇用形態を選ぶ"
                          )}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="雇用形態">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              if (
                                isSelectionAllOf(
                                  parsed.employments,
                                  employmentOptions
                                )
                              ) {
                                patchFilter({ employments: undefined });
                              } else if (employmentOptions.length > 0) {
                                patchFilter({
                                  employments: [...employmentOptions],
                                });
                              }
                            }}
                          >
                            {isSelectionAllOf(
                              parsed.employments,
                              employmentOptions
                            )
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {employmentOptions.map((e) => (
                            <label
                              key={e}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.employments?.includes(e) ?? false
                                }
                                onChange={() => toggleEmployment(e)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span className="break-all">{e}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-sumi/90">
                      職種（複数可）
                      {/* {jobCategoryGroupsConfigured() ? (
                        <span className="block font-normal text-sumi/60">
                          資格求人の条件（グループ別・マスタ参照）
                        </span>
                      ) : null} */}
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.jobCategories?.length
                              ? parsed.jobCategories.join("、")
                              : undefined
                          }
                        >
                          {filterDropdownLabel(
                            parsed.jobCategories,
                            "クリックして職種を選ぶ"
                          )}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="職種">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              if (
                                isSelectionAllOf(
                                  parsed.jobCategories,
                                  jobCategoryOptions
                                )
                              ) {
                                patchFilter({ jobCategories: undefined });
                              } else if (jobCategoryOptions.length > 0) {
                                patchFilter({
                                  jobCategories: [...jobCategoryOptions],
                                });
                              }
                            }}
                          >
                            {isSelectionAllOf(
                              parsed.jobCategories,
                              jobCategoryOptions
                            )
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {jobCategoryOptions.map((c) => (
                            <label
                              key={c}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.jobCategories?.includes(c) ?? false
                                }
                                onChange={() => toggleJobCategory(c)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span className="break-all">{c}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sumi/90">
                      サービス種別（複数可）
                      <span className="group relative inline-block">
                        <span className="cursor-help select-none rounded-full border border-red-300 bg-red-50 px-1 text-[9px] font-bold text-red-700 hover:border-red-400 hover:bg-red-100 hover:text-red-800">
                          ⚠
                        </span>
                        <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border border-red-300 bg-red-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                          各媒体毎に入力・選択定義が大きく異なる為、グルーピングが出来ませんでした。つきましては本項目の利用及び選択は推奨致しません。参考程度にご利用下さい。
                        </span>
                      </span>
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.serviceTypes?.length
                              ? parsed.serviceTypes.join("、")
                              : undefined
                          }
                        >
                          {filterDropdownLabel(
                            parsed.serviceTypes,
                            "クリックしてサービス種別を選ぶ"
                          )}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="サービス種別">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              if (
                                isSelectionAllOf(
                                  parsed.serviceTypes,
                                  serviceTypeOptions
                                )
                              ) {
                                patchFilter({ serviceTypes: undefined });
                              } else if (serviceTypeOptions.length > 0) {
                                patchFilter({
                                  serviceTypes: [...serviceTypeOptions],
                                });
                              }
                            }}
                          >
                            {isSelectionAllOf(
                              parsed.serviceTypes,
                              serviceTypeOptions
                            )
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {serviceTypeOptions.map((c) => (
                            <label
                              key={c}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.serviceTypes?.includes(c) ?? false
                                }
                                onChange={() => toggleServiceType(c)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span className="break-all">{c}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                </div>
              </fieldset>

              <fieldset className="min-h-0 rounded-lg border border-wash bg-white/95 px-2.5 py-2 shadow-sm sm:px-3">
                <legend className="text-[11px] font-semibold text-ink">
                  給与（CSV の支給区分・金額）
                </legend>
                <p className="mb-1.5 text-[10px] leading-snug text-sumi/70">
                  月給・時給・日給で絞り込みます。
                </p>
                <div className="mt-0.5 space-y-3">
                  <div className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-medium text-sumi/90">
                      支給区分（複数可）
                    </span>
                    <details className={FILTER_DROPDOWN_DETAILS}>
                      <summary className={FILTER_DROPDOWN_SUMMARY}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={
                            parsed.paymentTypes?.length
                              ? parsed.paymentTypes.join("、")
                              : undefined
                          }
                        >
                          {filterDropdownLabel(
                            parsed.paymentTypes,
                            "クリックして支給区分を選ぶ"
                          )}
                        </span>
                        <FilterDropdownChevron />
                      </summary>
                      <FilterDropdownPanel ariaLabel="支給区分">
                        <div className="flex items-center gap-2 border-b border-wash/80 bg-paper/30 px-2 py-1">
                          <button
                            type="button"
                            className={SELECT_ALL_BTN}
                            onClick={() => {
                              const allPm = [
                                ...PAYMENT_TYPE_OPTIONS,
                              ] as PaymentTypeOption[];
                              if (
                                isSelectionAllOf(
                                  parsed.paymentTypes,
                                  allPm
                                )
                              ) {
                                patchFilter({ paymentTypes: undefined });
                              } else {
                                patchFilter({ paymentTypes: allPm });
                              }
                            }}
                          >
                            {isSelectionAllOf(
                              parsed.paymentTypes,
                              [...PAYMENT_TYPE_OPTIONS]
                            )
                              ? "全て解除"
                              : "全て選択"}
                          </button>
                          <CloseDropdownBtn />
                        </div>
                        <div className={FILTER_CHECKBOX_LIST}>
                          {PAYMENT_TYPE_OPTIONS.map((pm) => (
                            <label
                              key={pm}
                              className="flex cursor-pointer items-center gap-2 py-0.5 text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  parsed.paymentTypes?.includes(pm) ?? false
                                }
                                onChange={() => togglePaymentType(pm)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-wash text-ai focus:ring-ai"
                              />
                              <span>{pm}</span>
                            </label>
                          ))}
                        </div>
                      </FilterDropdownPanel>
                    </details>
                  </div>
                  <p className="text-[10px] leading-snug text-sumi/70">
                    ※金額は円単位で入力下さい。（例 / 月給の場合）300000
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                    <label className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-sumi/90">
                        下限
                      </span>
                      <input
                        key={`salaryGte-${parsed.salaryGte ?? ""}`}
                        name="salaryGte"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        defaultValue={
                          parsed.salaryGte !== undefined
                            ? String(parsed.salaryGte)
                            : ""
                        }
                        title="求人の下限額（salary_min）がこの値以上の求人"
                        onBlur={() => applySalaryFromForm()}
                        className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-sumi/90">
                        上限
                      </span>
                      <input
                        key={`salaryLte-${parsed.salaryLte ?? ""}`}
                        name="salaryLte"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        defaultValue={
                          parsed.salaryLte !== undefined
                            ? String(parsed.salaryLte)
                            : ""
                        }
                        title="求人の上限額（salary_max）がこの値以下の求人"
                        onBlur={() => applySalaryFromForm()}
                        className="w-full min-w-0 rounded-lg border border-wash bg-white px-2 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
                      />
                    </label>
                  </div>
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
                      value={parsed.sort}
                      onChange={(e) => {
                        const v = e.target.value;
                        const sort: ParsedJobsQuery["sort"] =
                          v === "salary_high" ||
                          v === "salary_low" ||
                          v === "name_asc"
                            ? v
                            : "imported_desc";
                        patchFilter({ sort });
                      }}
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

        <section
          className="shrink-0 border-t border-wash/80 bg-white px-3 py-2 sm:px-4"
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
                value={keywordDraft}
                placeholder="施設名・職種・市区町村など（入力後しばらくで反映）"
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setKeywordDraft(v);
                  keywordDraftRef.current = v;
                  scheduleKeywordApply();
                }}
                className="w-full rounded-lg border border-wash bg-paper/50 px-2.5 py-1.5 text-xs text-ink shadow-sm outline-none ring-ai/15 focus:ring-2"
              />
            </label>
          </form>
        </section>
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
          title="最大5万件まで。現在のキーワード・検索条件を反映します。"
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
