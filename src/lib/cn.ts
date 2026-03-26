/**
 * 条件付きクラス名の結合（依存なしの軽量版）
 */
export function cn(...parts: (string | undefined | null | false)[]): string {
  return parts.filter(Boolean).join(" ");
}
