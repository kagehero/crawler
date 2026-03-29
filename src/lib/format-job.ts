/** 給与表示（DB が「万円」または「円」のどちらでも見やすく） */
export function formatSalaryRange(min: number, max: number): string {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  if (a <= 0 && b <= 0) return "—";

  const toMan = (n: number) => (n >= 10_000 ? Math.round(n / 10_000) : n);

  const ta = toMan(a);
  const tb = toMan(b);

  return `${ta.toLocaleString("ja-JP")}〜${tb.toLocaleString("ja-JP")}万円`;
}

export function sourceLabel(source?: string): string {
  switch (source) {
    case "job_medley":
      return "ジョブメドレー";
    case "wellme":
      return "ウェルミー";
    case "unknown":
      return "その他";
    default:
      return source || "—";
  }
}
