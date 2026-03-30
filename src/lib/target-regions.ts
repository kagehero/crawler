/**
 * ウェルミー／ジョブメドレー取得の対象エリア（都道府県と市区町村）。
 * crawler/site_url_wellme_raks の行と対応。変更時はスクレイパー入力ファイルも合わせて更新してください。
 */
export type TargetRegion = {
  prefecture: string;
  cities: string[];
};

export const TARGET_REGIONS: TargetRegion[] = [
  {
    prefecture: "東京都",
    cities: [
      "中央区",
      "足立区",
      "板橋区",
      "武蔵村山市",
      "東大和市",
      "西東京市",
      "練馬区",
    ],
  },
  {
    prefecture: "埼玉県",
    cities: ["川越市", "春日部市", "坂戸市", "草加市", "北足立郡"],
  },
  {
    prefecture: "千葉県",
    cities: [
      "船橋市",
      "千葉市若葉区",
      "柏市",
      "長生郡",
      "千葉市稲毛区",
      "大網白里市",
      "千葉市美浜区",
      "千葉市中央区",
      "山武郡",
      "東金市",
    ],
  },
  {
    prefecture: "神奈川県",
    cities: ["川崎市高津区"],
  },
  {
    prefecture: "福岡県",
    cities: ["福岡市博多区", "福岡市城南区", "久留米市"],
  },
  {
    prefecture: "静岡県",
    cities: ["袋井市"],
  },
  {
    prefecture: "京都府",
    cities: ["長岡京市"],
  },
  {
    prefecture: "兵庫県",
    cities: ["川西市", "宝塚市"],
  },
];

export function targetPrefectureLabels(): string[] {
  return TARGET_REGIONS.map((r) => r.prefecture);
}

/** 指定都道府県の対象市区町村（該当なしは空配列） */
export function citiesForTargetPrefecture(prefecture: string): string[] {
  const row = TARGET_REGIONS.find((r) => r.prefecture === prefecture);
  return row ? [...row.cities] : [];
}

/** 対象エリアの市区町村をすべて（重複なし） */
export function allTargetCities(): string[] {
  const set = new Set<string>();
  for (const r of TARGET_REGIONS) {
    for (const c of r.cities) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}
