/** 求人 API / CSV エクスポート共通のクエリ・Mongo フィルタ */

import {
  employmentToCanonical,
  expandEmploymentForQuery,
} from "@/lib/employment-normalization";

const SOURCES = ["job_medley", "wellme", "unknown"] as const;
export type JobSource = (typeof SOURCES)[number];

/** CSV の支給区分（検索は月給・時給・日給のみ） */
export const PAYMENT_TYPE_OPTIONS = ["月給", "時給", "日給"] as const;
export type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];

export type ParsedJobsQuery = {
  page: number;
  limit: number;
  q?: string;
  /** 都道府県（複数指定時はいずれかに一致） */
  prefectures?: string[];
  /** 市区町村（複数指定時はいずれかに一致） */
  cities?: string[];
  /** 媒体（複数指定時はいずれかに一致） */
  sources?: JobSource[];
  /** 雇用形態（複数指定時はいずれかに一致） */
  employments?: string[];
  /** 職種（複数指定時はいずれかに一致） */
  jobCategories?: string[];
  /** サービス種別（複数指定時はいずれかに一致） */
  serviceTypes?: string[];
  /** 支給区分（payment_method と一致・複数はいずれか） */
  paymentTypes?: PaymentTypeOption[];
  salaryGte?: number;
  salaryLte?: number;
  sort: "imported_desc" | "salary_high" | "salary_low" | "name_asc";
};

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_EXPORT_ROWS = 50_000;

/** 求人一覧のデフォルトの 1 ページあたり件数 */
export const JOBS_PAGE_SIZE = 25;

/** 画面の「1ページの件数」セレクト用（URL の `limit` もこのいずれか） */
export const JOBS_PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function parsePaymentTypes(sp: URLSearchParams): PaymentTypeOption[] | undefined {
  const list = uniqueStrings(sp.getAll("paymentType"));
  const ok = list.filter((t) =>
    (PAYMENT_TYPE_OPTIONS as readonly string[]).includes(t)
  ) as PaymentTypeOption[];
  return ok.length ? ok : undefined;
}

export function parseJobsSearchParams(
  sp: URLSearchParams,
  opts?: { isExport?: boolean }
): ParsedJobsQuery {
  const isExport = opts?.isExport === true;
  const page = isExport
    ? 1
    : Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  let limit: number;
  if (isExport) {
    const req = parseInt(sp.get("limit") ?? "", 10);
    limit = Math.min(
      MAX_EXPORT_ROWS,
      Math.max(1, Number.isFinite(req) ? req : MAX_EXPORT_ROWS)
    );
  } else {
    const raw = parseInt(sp.get("limit") ?? String(JOBS_PAGE_SIZE), 10);
    limit = (JOBS_PAGE_LIMIT_OPTIONS as readonly number[]).includes(raw)
      ? raw
      : JOBS_PAGE_SIZE;
  }

  const q = sp.get("q")?.trim() || undefined;
  const prefecturesRaw = uniqueStrings(sp.getAll("prefecture"));
  const prefectures = prefecturesRaw.length ? prefecturesRaw : undefined;
  const citiesRaw = uniqueStrings(sp.getAll("city"));
  const cities = citiesRaw.length ? citiesRaw : undefined;
  const employmentsRaw = uniqueStrings(sp.getAll("employment"));
  const employments = employmentsRaw.length
    ? uniqueStrings(employmentsRaw.map(employmentToCanonical))
    : undefined;
  const jobCategoriesRaw = uniqueStrings(sp.getAll("jobCategory"));
  const jobCategories = jobCategoriesRaw.length ? jobCategoriesRaw : undefined;
  const serviceTypesRaw = uniqueStrings(sp.getAll("serviceType"));
  const serviceTypes = serviceTypesRaw.length ? serviceTypesRaw : undefined;
  const paymentTypes = parsePaymentTypes(sp);

  const sourcesRaw = uniqueStrings(sp.getAll("source"));
  const sourcesFiltered = sourcesRaw.filter((s) =>
    (SOURCES as readonly string[]).includes(s)
  ) as JobSource[];
  const sources =
    sourcesFiltered.length > 0
      ? ([...new Set(sourcesFiltered)] as JobSource[])
      : undefined;

  const salaryGteRaw = sp.get("salaryGte")?.trim();
  const salaryLteRaw = sp.get("salaryLte")?.trim();
  let salaryGte: number | undefined;
  let salaryLte: number | undefined;
  if (salaryGteRaw !== undefined && salaryGteRaw !== "") {
    const n = Number(salaryGteRaw);
    if (Number.isFinite(n)) salaryGte = n;
  }
  if (salaryLteRaw !== undefined && salaryLteRaw !== "") {
    const n = Number(salaryLteRaw);
    if (Number.isFinite(n)) salaryLte = n;
  }

  const sortRaw = sp.get("sort")?.trim() ?? "imported_desc";
  const sort: ParsedJobsQuery["sort"] =
    sortRaw === "salary_high" ||
    sortRaw === "salary_low" ||
    sortRaw === "name_asc"
      ? sortRaw
      : "imported_desc";

  return {
    page,
    limit,
    q,
    prefectures,
    cities,
    sources,
    employments,
    jobCategories,
    serviceTypes,
    paymentTypes,
    salaryGte,
    salaryLte,
    sort,
  };
}

/** MongoDB 用フィルタ（単一オブジェクトまたは $and） */
export function buildJobsMongoFilter(p: ParsedJobsQuery): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];

  if (p.prefectures && p.prefectures.length > 0) {
    if (p.prefectures.length === 1) {
      parts.push({ prefecture: p.prefectures[0] });
    } else {
      parts.push({ prefecture: { $in: p.prefectures } });
    }
  }
  if (p.cities && p.cities.length > 0) {
    if (p.cities.length === 1) {
      parts.push({ city: p.cities[0] });
    } else {
      parts.push({ city: { $in: p.cities } });
    }
  }
  if (p.sources && p.sources.length > 0) {
    if (p.sources.length === 1) {
      parts.push({ source: p.sources[0] });
    } else {
      parts.push({ source: { $in: p.sources } });
    }
  }
  if (p.employments && p.employments.length > 0) {
    const expanded = expandEmploymentForQuery(p.employments);
    if (expanded.length === 1) {
      parts.push({ employment_type: expanded[0] });
    } else {
      parts.push({ employment_type: { $in: expanded } });
    }
  }
  if (p.jobCategories && p.jobCategories.length > 0) {
    if (p.jobCategories.length === 1) {
      parts.push({ job_category: p.jobCategories[0] });
    } else {
      parts.push({ job_category: { $in: p.jobCategories } });
    }
  }
  /** サービス種別: 求人の service_type 文字列に「選択語が含まれる」ものを OR でマッチ */
  if (p.serviceTypes && p.serviceTypes.length > 0) {
    if (p.serviceTypes.length === 1) {
      parts.push({
        service_type: {
          $regex: escapeRegex(p.serviceTypes[0]!),
          $options: "i",
        },
      });
    } else {
      parts.push({
        $or: p.serviceTypes.map((s) => ({
          service_type: { $regex: escapeRegex(s), $options: "i" },
        })),
      });
    }
  }
  if (p.paymentTypes && p.paymentTypes.length > 0) {
    if (p.paymentTypes.length === 1) {
      parts.push({ payment_method: p.paymentTypes[0] });
    } else {
      parts.push({ payment_method: { $in: p.paymentTypes } });
    }
  }

  if (p.salaryGte !== undefined) {
    parts.push({ salary_max: { $gte: p.salaryGte } });
  }
  if (p.salaryLte !== undefined) {
    parts.push({ salary_min: { $lte: p.salaryLte } });
  }

  if (p.q) {
    const rx = escapeRegex(p.q);
    parts.push({
      $or: [
        { facility_name: { $regex: rx, $options: "i" } },
        { job_type: { $regex: rx, $options: "i" } },
        { job_category: { $regex: rx, $options: "i" } },
        { city: { $regex: rx, $options: "i" } },
        { employment_type: { $regex: rx, $options: "i" } },
      ],
    });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}

export function jobsSortSpec(
  sort: ParsedJobsQuery["sort"]
): Record<string, 1 | -1> {
  switch (sort) {
    case "salary_high":
      return { salary_max: -1, importedAt: -1 };
    case "salary_low":
      return { salary_min: 1, importedAt: -1 };
    case "name_asc":
      return { facility_name: 1, importedAt: -1 };
    default:
      return { importedAt: -1 };
  }
}

/** 一覧用（ページ番号・1 ページあたり件数を URL に含む） */
export function jobsQueryToSearchParams(
  p: ParsedJobsQuery,
  overrides?: Partial<ParsedJobsQuery>
): URLSearchParams {
  const m = { ...p, ...overrides };
  const sp = filterParamsToSearchParams(m);
  sp.set("page", String(m.page));
  sp.set("limit", String(m.limit));
  return sp;
}

/** フィルタのみ（CSV エクスポート URL 用。page / limit は含めない） */
export function filterParamsToSearchParams(
  p: ParsedJobsQuery
): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  for (const x of p.prefectures ?? []) sp.append("prefecture", x);
  for (const x of p.cities ?? []) sp.append("city", x);
  for (const x of p.sources ?? []) sp.append("source", x);
  for (const x of p.employments ?? []) sp.append("employment", x);
  for (const x of p.jobCategories ?? []) sp.append("jobCategory", x);
  for (const x of p.serviceTypes ?? []) sp.append("serviceType", x);
  for (const x of p.paymentTypes ?? []) sp.append("paymentType", x);
  if (p.salaryGte !== undefined) sp.set("salaryGte", String(p.salaryGte));
  if (p.salaryLte !== undefined) sp.set("salaryLte", String(p.salaryLte));
  if (p.sort && p.sort !== "imported_desc") sp.set("sort", p.sort);
  return sp;
}
