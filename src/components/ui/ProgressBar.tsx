"use client";

import { cn } from "@/lib/cn";

export type ProgressBarProps = {
  /** 0〜100。`indeterminate` 時は無視 */
  value?: number;
  /** 不定の進捗（長さが不明な処理向け） */
  indeterminate?: boolean;
  /** ラベル（上に表示） */
  label?: string;
  /** 右側にパーセント表示 */
  showPercent?: boolean;
  size?: "sm" | "md";
  className?: string;
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

/**
 * 横型プログレスバー。確定値・不定（スライド）の両方に対応。
 */
export function ProgressBar({
  value = 0,
  indeterminate = false,
  label,
  showPercent = false,
  size = "md",
  className,
}: ProgressBarProps) {
  const v = clamp(value);
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-sumi/80">
          {label ? <span>{label}</span> : <span />}
          {showPercent && !indeterminate ? (
            <span className="tabular-nums text-sumi">{Math.round(v)}%</span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : v}
        aria-label={label ?? "進捗"}
        className={cn(
          "w-full overflow-hidden rounded-full bg-wash ring-1 ring-stone-200/80",
          height
        )}
      >
        {indeterminate ? (
          <div
            className={cn(
              "h-full w-1/3 rounded-full bg-gradient-to-r from-ai/40 via-ai to-aiMuted",
              "animate-progress-indeterminate"
            )}
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-full bg-ai transition-[width] duration-300 ease-out",
              "shadow-sm"
            )}
            style={{ width: `${v}%` }}
          />
        )}
      </div>
    </div>
  );
}
