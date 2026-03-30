/** 給与表示（DB が「万円」または「円」のどちらでも見やすく） */
export function formatSalaryRange(min: number, max: number): string {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  if (a <= 0 && b <= 0) return "—";

  const toMan = (n: number) => (n >= 10_000 ? Math.round(n / 10_000) : n);

  const ta = toMan(a);
  const tb = toMan(b);
  const fmt = (n: number) => n.toLocaleString("ja-JP");

  // 片方だけ入っている・0 のときに「40〜0万円」のように見えないようにする
  if (ta > 0 && tb <= 0) return `${fmt(ta)}万円〜`;
  if (ta <= 0 && tb > 0) return `〜${fmt(tb)}万円`;
  if (ta > tb) return `${fmt(tb)}〜${fmt(ta)}万円`;

  return `${fmt(ta)}〜${fmt(tb)}万円`;
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
