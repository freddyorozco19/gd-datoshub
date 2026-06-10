"use client";

import { Bell, Search } from "lucide-react";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.07] bg-[#0e0e1c] shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] text-slate-400 text-sm hover:bg-white/[0.09] transition-colors">
          <Search size={14} />
          <span className="hidden sm:inline">Buscar…</span>
        </button>
        <button className="relative p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
