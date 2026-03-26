"use client";

import { cn } from "@/lib/cn";

const sizeMap = {
  sm: "h-5 w-5 border-2",
  md: "h-9 w-9 border-[3px]",
  lg: "h-12 w-12 border-[3px]",
} as const;

export type LoadingSpinnerProps = {
  /** 表示サイズ */
  size?: keyof typeof sizeMap;
  /** スピナー下の短い説明（例: 読み込み中…） */
  label?: string;
  /** true のとき画面中央にオーバーレイ（モーダル的） */
  overlay?: boolean;
  className?: string;
};

/**
 * 円形のローディングインジケータ（鉄紺アクセント）
 */
export function LoadingSpinner({
  size = "md",
  label,
  overlay = false,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col items-center justify-center gap-3", className)}
    >
      <div
        className={cn(
          "rounded-full border-wash border-t-ai animate-spin",
          sizeMap[size]
        )}
      />
      {label ? (
        <p className="text-sm text-sumi/80 animate-fade-in">{label}</p>
      ) : (
        <span className="sr-only">読み込み中</span>
      )}
    </div>
  );

  if (!overlay) return spinner;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-[2px] animate-fade-in"
      aria-hidden={false}
    >
      {spinner}
    </div>
  );
}
