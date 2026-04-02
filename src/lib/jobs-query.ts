/** 求人 API / CSV エクスポート共通のクエリ・Mongo フィルタ */

const SOURCES = ["job_medley", "wellme", "unknown"] as const;
export type JobSource = (typeof SOURCES)[number];

/** CSV の支給区分（検索は月給・時給・日給のみ） */
export const PAYMENT_TYPE_OPTIONS = ["月給", "時給", "日給"] as const;
export type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];

export type ParsedJobsQuery = {
  page: number;
  limit: number;
  q?: string;
  prefecture?: string;
  city?: string;
  source?: JobSource;
  employment?: string;
  jobCategory?: string;
  serviceType?: string;
  /** 支給区分（payment_method と一致） */
  paymentType?: PaymentTypeOption;
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

function parsePaymentType(
  raw: string | null | undefined
): PaymentTypeOption | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  return (PAYMENT_TYPE_OPTIONS as readonly string[]).includes(t)
    ? (t as PaymentTypeOption)
    : undefined;
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
  const prefecture = sp.get("prefecture")?.trim() || undefined;
  const city = sp.get("city")?.trim() || undefined;
  const employment = sp.get("employment")?.trim() || undefined;
  const jobCategory = sp.get("jobCategory")?.trim() || undefined;
  const serviceType = sp.get("serviceType")?.trim() || undefined;
  const paymentType = parsePaymentType(sp.get("paymentType"));

  const srcRaw = sp.get("source")?.trim();
  const source =
    srcRaw && (SOURCES as readonly string[]).includes(srcRaw)
      ? (srcRaw as JobSource)
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
    prefecture,
    city,
    source,
    employment,
    jobCategory,
    serviceType,
    paymentType,
    salaryGte,
    salaryLte,
    sort,
  };
}

/** MongoDB 用フィルタ（単一オブジェクトまたは $and） */
export function buildJobsMongoFilter(p: ParsedJobsQuery): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];

  if (p.prefecture) {
    parts.push({ prefecture: p.prefecture });
  }
  if (p.city) {
    parts.push({ city: p.city });
  }
  if (p.source) {
    parts.push({ source: p.source });
  }
  if (p.employment) {
    parts.push({
      employment_type: { $regex: escapeRegex(p.employment), $options: "i" },
    });
  }
  if (p.jobCategory) {
    parts.push({ job_category: p.jobCategory });
  }
  if (p.serviceType) {
    parts.push({ service_type: p.serviceType });
  }
  if (p.paymentType) {
    parts.push({ payment_method: p.paymentType });
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
  if (p.prefecture) sp.set("prefecture", p.prefecture);
  if (p.city) sp.set("city", p.city);
  if (p.source) sp.set("source", p.source);
  if (p.employment) sp.set("employment", p.employment);
  if (p.jobCategory) sp.set("jobCategory", p.jobCategory);
  if (p.serviceType) sp.set("serviceType", p.serviceType);
  if (p.paymentType) sp.set("paymentType", p.paymentType);
  if (p.salaryGte !== undefined) sp.set("salaryGte", String(p.salaryGte));
  if (p.salaryLte !== undefined) sp.set("salaryLte", String(p.salaryLte));
  if (p.sort && p.sort !== "imported_desc") sp.set("sort", p.sort);
  return sp;
}
