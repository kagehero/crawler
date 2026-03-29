"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-wash bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm lg:hidden">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-sumi/60">
            求人データ
          </p>
          <p className="text-sm font-semibold text-ai">管理コンソール</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg border border-wash bg-paper px-3 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-wash"
          aria-expanded={menuOpen}
        >
          メニュー
        </button>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="ナビゲーション"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
            aria-label="閉じる"
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,92vw)] flex-col bg-white shadow-2xl">
            <Sidebar variant="drawer" onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      <main className="min-h-screen flex-1 overflow-x-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
