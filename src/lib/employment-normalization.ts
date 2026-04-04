/**
 * 雇用形態の表記ゆれを UI・検索で同一視する（媒体ごとの表記差を吸収）。
 */

/** 統一表示名 → DB にあり得る生の値 */
export const EMPLOYMENT_CANONICAL_TO_VARIANTS: Record<string, string[]> = {
  正社員: ["正社員", "正職員"],
  "パート・アルバイト": ["パート・アルバイト", "パート・バイト"],
  契約社員: ["契約社員", "契約職員"],
};

/** 生の値 → 統一表示名（マップ外はそのまま） */
export function employmentToCanonical(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  for (const [canonical, variants] of Object.entries(
    EMPLOYMENT_CANONICAL_TO_VARIANTS
  )) {
    if (variants.includes(t)) return canonical;
  }
  return t;
}

/** distinct 一覧を統一ラベルに畳み、重複を除いてソート */
export function canonicalEmploymentOptions(distinctRaw: string[]): string[] {
  const set = new Set<string>();
  for (const r of distinctRaw) {
    const c = employmentToCanonical(r);
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

/** URL / 検索用: 選択値（統一ラベルまたは旧表記）を Mongo $in 用の生値に展開 */
export function expandEmploymentForQuery(selected: string[]): string[] {
  const out = new Set<string>();
  for (const c of selected) {
    const canonical = employmentToCanonical(c);
    const variants = EMPLOYMENT_CANONICAL_TO_VARIANTS[canonical];
    if (variants) variants.forEach((x) => out.add(x));
    else if (c.trim()) out.add(c.trim());
  }
  return [...out];
}
