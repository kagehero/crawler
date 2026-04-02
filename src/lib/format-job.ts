/** CSV で支給が「年収」の求人は一覧では金額・区分とも表示しない（データ品質のため） */
export function isAnnualSalaryPayment(paymentMethod?: string): boolean {
  return String(paymentMethod ?? "").trim() === "年収";
}

/** 一覧の「支給」列。年収は出さない */
export function formatPaymentMethodForList(paymentMethod?: string): string {
  if (isAnnualSalaryPayment(paymentMethod)) return "—";
  return paymentMethod?.trim() || "—";
}

/** 一覧の「給与」列。DB の salary_min / salary_max を単位換算せず表示（年収区分は非表示） */
export function formatSalaryRangeForList(
  paymentMethod: string | undefined,
  min: number,
  max: number
): string {
  if (isAnnualSalaryPayment(paymentMethod)) return "—";
  const a = Number(min);
  const b = Number(max);
  const fa = Number.isFinite(a);
  const fb = Number.isFinite(b);
  const hasA = fa && a !== 0;
  const hasB = fb && b !== 0;
  if (!hasA && !hasB) return "—";

  const fmt = (n: number) =>
    Number.isInteger(n)
      ? n.toLocaleString("ja-JP")
      : n.toLocaleString("ja-JP", { maximumFractionDigits: 6 });

  if (hasA && !hasB) return `${fmt(a)}〜`;
  if (!hasA && hasB) return `〜${fmt(b)}`;
  return `${fmt(a)}〜${fmt(b)}`;
}

/** 給与レンジ表示（万円表記・他画面用。一覧は {@link formatSalaryRangeForList} を使用） */
export function formatSalaryRange(min: number, max: number): string {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  if (a <= 0 && b <= 0) return "—";

  const toMan = (n: number) => (n >= 10_000 ? Math.round(n / 10_000) : n);

  const ta = toMan(a);
  const tb = toMan(b);
  const fmt = (n: number) => n.toLocaleString("ja-JP");

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
