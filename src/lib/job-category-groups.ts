import raw from "@/data/job-category-groups.json";
import { expandJobMedleyCategoryForIn } from "@/lib/job-medley-category-canonical";
import { expandWellmeCategoryForIn } from "@/lib/wellme-category-canonical";

export type JobCategoryGroupRow = {
  /** 画面の選択肢（Excel F 列に相当） */
  label: string;
  /** ジョブメドレー側の job_category に一致させる文字列（Excel B 列・複数行は同一 label でマージ） */
  jobMedleyCategories: string[];
  /** ウェルミー側の job_category に一致させる文字列（Excel C 列） */
  wellmeCategories: string[];
};

type JsonFile = { groups: JobCategoryGroupRow[] };

function normalizeGroups(data: JsonFile): JobCategoryGroupRow[] {
  const rows = data.groups ?? [];
  const byLabel = new Map<string, JobCategoryGroupRow>();
  for (const g of rows) {
    const label = (g.label ?? "").trim();
    if (!label) continue;
    const jm = (g.jobMedleyCategories ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const wm = (g.wellmeCategories ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const prev = byLabel.get(label);
    if (!prev) {
      byLabel.set(label, {
        label,
        jobMedleyCategories: [...new Set(jm)],
        wellmeCategories: [...new Set(wm)],
      });
    } else {
      const mj = new Set([...prev.jobMedleyCategories, ...jm]);
      const wj = new Set([...prev.wellmeCategories, ...wm]);
      byLabel.set(label, {
        label,
        jobMedleyCategories: [...mj],
        wellmeCategories: [...wj],
      });
    }
  }
  return [...byLabel.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ja")
  );
}

const GROUPS: JobCategoryGroupRow[] = normalizeGroups(raw as JsonFile);

export function jobCategoryGroupsConfigured(): boolean {
  return GROUPS.length > 0;
}

export function jobCategoryGroupLabels(): string[] {
  return GROUPS.map((g) => g.label);
}

const labelToGroup = new Map<string, JobCategoryGroupRow>(
  GROUPS.map((g) => [g.label, g])
);

/** URL / クエリに含まれる職種フィルタを、グループラベルとレガシー生文字列に分ける */
export function partitionJobCategorySelection(selected: string[]): {
  groupLabels: string[];
  legacyRaw: string[];
} {
  const groupLabels: string[] = [];
  const legacyRaw: string[] = [];
  for (const s of selected) {
    const t = s.trim();
    if (!t) continue;
    if (labelToGroup.has(t)) groupLabels.push(t);
    else legacyRaw.push(t);
  }
  return { groupLabels, legacyRaw };
}

/**
 * グループ定義に基づき Mongo 条件を組み立てる。
 * - job_medley: B 列相当の文字列のみ
 * - wellme: C 列相当の文字列のみ
 * - unknown: 両方の和集合で $in（表記ゆれ対策）
 */
export function buildJobCategoryGroupMongoCondition(
  groupLabels: string[]
): Record<string, unknown> | null {
  if (groupLabels.length === 0) return null;
  const medley = new Set<string>();
  const wellme = new Set<string>();
  for (const lab of groupLabels) {
    const g = labelToGroup.get(lab);
    if (!g) continue;
    g.jobMedleyCategories.forEach((x) => medley.add(x));
    g.wellmeCategories.forEach((x) => wellme.add(x));
  }
  /** Excel B/C 列の表記は保存される job_category と異なることがあるため正規ラベルへ展開 */
  const medleyForIn = expandJobMedleyCategoryForIn([...medley]);
  const wellmeForIn = expandWellmeCategoryForIn([...wellme]);
  const parts: Record<string, unknown>[] = [];
  if (medleyForIn.length > 0) {
    parts.push({
      source: "job_medley",
      job_category: { $in: medleyForIn },
    });
  }
  if (wellmeForIn.length > 0) {
    parts.push({
      source: "wellme",
      job_category: { $in: wellmeForIn },
    });
  }
  const unknownUnion = new Set([...medleyForIn, ...wellmeForIn]);
  if (unknownUnion.size > 0) {
    parts.push({
      source: "unknown",
      job_category: { $in: [...unknownUnion] },
    });
  }
  if (parts.length === 0) {
    return { job_category: { $in: [] as string[] } };
  }
  if (parts.length === 1) return parts[0]!;
  return { $or: parts };
}
