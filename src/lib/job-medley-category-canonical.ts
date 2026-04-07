/**
 * Values written to Mongo `job_category` for source = job_medley.
 * Mirrors `JOB_MEDLEY_PATH_TO_CATEGORY` values in crawler/scraper/job_medley.py
 * (URL path → single fixed label for search).
 */
export const JOB_MEDLEY_JOB_CATEGORY_CANONICAL_VALUES: readonly string[] = [
  "鍼灸師",
  "看護師/准看護師",
  "児童指導員/指導員",
  "薬剤師",
  "放課後児童支援員/学童指導員",
  "保育補助",
  "美容部員",
  "理容師",
  "整体師",
  "介護事務",
  "臨床工学技士",
  "調理師/調理スタッフ",
  "清掃/環境整備",
  "ケアマネジャー",
  "公認心理師/臨床心理士",
  "臨床開発モニター",
  "治験コーディネーター",
  "医療ソーシャルワーカー",
  "介護タクシー/ドライバー",
  "保育士",
  "歯科助手",
  "サービス管理責任者",
  "歯科医師",
  "歯科衛生士",
  "相談支援専門員",
  "医師",
  "ドライバー/配達員",
  "歯科技工士",
  "総合職/新卒/その他",
  "エステティシャン/セラピスト",
  "アイリスト",
  "福祉用具専門相談員",
  "介護職/ヘルパー",
  "美容師",
  "インストラクター",
  "柔道整復師",
  "サービス提供責任者",
  "幼稚園教諭",
  "生活相談員",
  "生活支援員",
  "あん摩マッサージ指圧師",
  "医療事務/受付",
  "管理職（介護）",
  "助産師",
  "臨床検査技師",
  "看護助手",
  "児童発達支援管理責任者",
  "管理栄養士/栄養士",
  "ネイリスト",
  "視能訓練士",
  "作業療法士",
  "登録販売者",
  "一般事務/管理部門",
  "調剤事務",
  "保健師",
  "理学療法士",
  "診療放射線技師",
  "営業",
  "言語聴覚士",
];

/** Excel B 列の表記とジョブメドレー正規 `job_category` が一致しないときの追加対応（いずれかが該当すれば $in に含める） */
const EXCEL_TO_CANONICAL_JM: ReadonlyArray<readonly [string, string]> = [
  ["整体師・セラピスト", "エステティシャン/セラピスト"],
  ["整体師・セラピスト", "整体師"],
  ["送迎ドライバー", "介護タクシー/ドライバー"],
  ["送迎ドライバー", "ドライバー/配達員"],
  ["事務・受付・管理", "一般事務/管理部門"],
  ["介護職員・ヘルパー", "介護職/ヘルパー"],
  ["児童指導員", "児童指導員/指導員"],
  ["医療事務", "医療事務/受付"],
  ["営業・企画", "営業"],
  ["放課後児童支援員・学童指導員", "放課後児童支援員/学童指導員"],
  ["生活支援員・世話人・就労支援員", "生活支援員"],
  ["生活相談員・相談職・ソーシャルワーカー", "生活相談員"],
  ["看護師・准看護師", "看護師/准看護師"],
  ["管理者・施設長・ホーム長", "管理職（介護）"],
  ["調理師・調理スタッフ", "調理師/調理スタッフ"],
  ["施設スタッフ(清掃・食事配膳・軽作業等)", "清掃/環境整備"],
];

function normalizeForMatch(s: string): string {
  return s.replace(/[・／]/g, "/").replace(/\s+/g, "");
}

/**
 * Expand Excel / マスタ由来の文字列ジョブメドレー職種を、DB に実際に保存される `job_category` 文言へ広げる。
 */
export function expandJobMedleyCategoryForIn(raw: string[]): string[] {
  const canonical = new Set(JOB_MEDLEY_JOB_CATEGORY_CANONICAL_VALUES);
  const out = new Set<string>();

  for (const s of raw) {
    out.add(s);
    if (canonical.has(s)) continue;

    for (const [excel, canon] of EXCEL_TO_CANONICAL_JM) {
      if (excel === s) out.add(canon);
    }

    const ns = normalizeForMatch(s);
    for (const c of JOB_MEDLEY_JOB_CATEGORY_CANONICAL_VALUES) {
      const nc = normalizeForMatch(c);
      if (ns === nc) {
        out.add(c);
        continue;
      }
      /** 長い Excel 表記が短い正規ラベルを含む場合（例: 介護支援専門員(ケアマネジャー) → ケアマネジャー） */
      if (c.length >= 4 && ns.includes(nc)) {
        out.add(c);
      }
    }
  }
  return [...out];
}
