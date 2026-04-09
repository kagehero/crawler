/**
 * WellMe (kaigojob.com) job_category canonical values scraped from job detail pages.
 * These use 「・」 separators and match the WellMe navigation labels.
 *
 * The Excel C column was populated with labels that often differ in format
 * (e.g. "介護職/ヘルパー" vs stored "介護職員・ヘルパー").
 * This module provides an expansion table to bridge the gap.
 */

/** Known WellMe job_category values as stored in MongoDB (from 職種名 field). */
export const WELLME_JOB_CATEGORY_CANONICAL_VALUES: readonly string[] = [
  "介護職員・ヘルパー",
  "生活相談員・相談職・ソーシャルワーカー",
  "介護支援専門員(ケアマネジャー)",
  "サービス提供責任者",
  "管理者・施設長・ホーム長",
  "看護師・准看護師",
  "保健師",
  "助産師",
  "看護助手",
  "医療事務",
  "生活支援員・世話人・就労支援員",
  "リハビリ職・機能訓練指導員",
  "サービス管理責任者",
  "相談支援専門員",
  "児童発達支援管理責任者",
  "児童指導員",
  "保育士",
  "送迎ドライバー",
  "施設スタッフ(清掃・食事配膳・軽作業等)",
  "管理栄養士・栄養士",
  "調理師・調理スタッフ",
  "福祉用具専門相談員",
  "営業・企画",
  "事務・受付・管理",
  "臨床検査技師",
  "臨床工学技士",
  "診療放射線技師",
  "理学療法士",
  "作業療法士",
  "言語聴覚士",
  "視能訓練士",
  "柔道整復師",
  "あん摩マッサージ指圧師",
  "鍼灸師",
  "整体師・セラピスト",
  "幼稚園教諭",
  "保育補助",
  "放課後児童支援員・学童指導員",
];

/**
 * Excel C column value → canonical WellMe job_category values in DB.
 * Handles format differences: / vs ・, missing 員, short vs long labels.
 */
const EXCEL_C_TO_WELLME: ReadonlyArray<readonly [string, string[]]> = [
  ["介護職/ヘルパー",              ["介護職員・ヘルパー", "介護職/ヘルパー"]],
  ["ケアマネジャー",               ["介護支援専門員(ケアマネジャー)", "ケアマネジャー"]],
  ["看護師/准看護師",              ["看護師・准看護師", "看護師/准看護師"]],
  ["管理職（介護）",               ["管理者・施設長・ホーム長", "管理職（介護）"]],
  ["生活相談員",                   ["生活相談員・相談職・ソーシャルワーカー", "生活相談員"]],
  ["生活支援員",                   ["生活支援員・世話人・就労支援員", "生活支援員"]],
  ["ドライバー/配達員",            ["送迎ドライバー", "ドライバー/配達員"]],
  ["一般事務/管理部門",            ["事務・受付・管理", "一般事務/管理部門"]],
  ["児童指導員/指導員",            ["児童指導員"]],
  ["医療事務/受付",                ["医療事務", "医療事務/受付"]],
  ["営業",                         ["営業・企画", "営業"]],
  ["放課後児童支援員/学童指導員",  ["放課後児童支援員・学童指導員"]],
  ["調理師/調理スタッフ",          ["調理師・調理スタッフ"]],
  ["整体師",                       ["整体師・セラピスト", "整体師"]],
  ["エステティシャン/セラピスト",  ["整体師・セラピスト", "エステティシャン/セラピスト"]],
  ["管理栄養士/栄養士",            ["管理栄養士・栄養士"]],
  ["リハビリ職・機能訓練指導員",   ["リハビリ職・機能訓練指導員"]],
  ["施設スタッフ(清掃・食事配膳・軽作業等)", ["施設スタッフ(清掃・食事配膳・軽作業等)"]],
];

const excelCMap = new Map<string, string[]>(EXCEL_C_TO_WELLME);

function normalizeSlash(s: string): string {
  return s.replace(/[/／]/g, "・").replace(/\s+/g, "");
}

/**
 * Expand Excel C-column labels to the actual job_category values stored in MongoDB
 * for wellme documents. Always includes the raw input as fallback.
 */
export function expandWellmeCategoryForIn(raw: string[]): string[] {
  const out = new Set<string>();
  for (const s of raw) {
    out.add(s);
    const mapped = excelCMap.get(s);
    if (mapped) {
      mapped.forEach((x) => out.add(x));
      continue;
    }
    /** Fallback: normalize / → ・ and try substring match in canonical list */
    const ns = normalizeSlash(s);
    for (const c of WELLME_JOB_CATEGORY_CANONICAL_VALUES) {
      const nc = normalizeSlash(c);
      if (ns === nc || (c.length >= 4 && nc.includes(ns))) {
        out.add(c);
      }
    }
  }
  return [...out];
}
