"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ホーム", hint: "件数・直近の取り込み" },
  { href: "/jobs", label: "求人一覧", hint: "検索・CSV" },
  { href: "/runs", label: "取り込み履歴", hint: "いつ取り込んだか" },
  { href: "/import", label: "CSV を取り込む", hint: "ファイルをアップロード" },
  { href: "/scrape", label: "スクレイピング", hint: "サーバーで実行する場合" },
  { href: "/settings", label: "設定", hint: "定期取得の予定" },
];

type SidebarProps = {
  variant?: "sidebar" | "drawer";
  onNavigate?: () => void;
};

export function Sidebar({ variant = "sidebar", onNavigate }: SidebarProps) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const wrapClass =
    variant === "drawer"
      ? "flex h-full w-full flex-col bg-white"
      : "flex w-60 shrink-0 flex-col border-r border-wash/80 bg-white/95 backdrop-blur-sm";

  return (
    <aside className={wrapClass}>
      <div className="border-b border-wash/80 px-5 py-6">
        <p className="text-[10px] font-medium uppercase tracking-widest text-sumi/60">
          求人データ
        </p>
        <h1 className="mt-1 text-lg font-semibold text-ai">管理コンソール</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {links.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => onNavigate?.()}
              className={`rounded-xl px-3 py-2.5 transition-colors ${
                active
                  ? "bg-wash text-ai shadow-sm"
                  : "text-sumi hover:bg-wash/70 hover:text-ink"
              }`}
            >
              <span className="block text-sm font-semibold">{l.label}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-sumi/65">
                {l.hint}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-wash/80 p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-sumi/85 transition hover:bg-stone-100 hover:text-ink"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
