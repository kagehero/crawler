"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ダッシュボード" },
  { href: "/jobs", label: "求人一覧" },
  { href: "/runs", label: "取り込み履歴" },
  { href: "/import", label: "CSV 取り込み" },
  { href: "/scrape", label: "スクレイピング" },
];

export function Sidebar() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-wash/80 bg-white/90 backdrop-blur-sm">
      <div className="border-b border-wash/80 px-5 py-6">
        <p className="text-xs font-medium uppercase tracking-widest text-sumi/70">
          Crawler
        </p>
        <h1 className="mt-1 text-lg font-semibold text-ai">管理コンソール</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-wash text-ai"
                  : "text-sumi hover:bg-wash/60 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-wash/80 p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-sumi/80 hover:bg-stone-100 hover:text-ink"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
