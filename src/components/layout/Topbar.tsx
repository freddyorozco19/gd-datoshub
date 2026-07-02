"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ReactNode } from "react";

/* ── Mapa de rutas → breadcrumb (igual que mainFJ-hub ROUTE_META) ─────── */
const ROUTE_META: Record<string, { label: string; parent?: string }> = {
  "/dashboard":       { label: "Dashboard" },
  "/leads":           { label: "Leads",          parent: "Comercial" },
  "/reuniones":       { label: "Reuniones",       parent: "Comercial" },
  "/integraciones":   { label: "Integraciones",   parent: "Sistemas"  },
  "/reportes":        { label: "Reportes",        parent: "Análisis"  },
  "/repositorios":    { label: "Repositorios",    parent: "Análisis"  },
  "/cmmi":            { label: "CMMI",            parent: "Análisis"  },
  "/certificaciones": { label: "Certificaciones", parent: "Análisis"  },
  "/usuarios":        { label: "Usuarios",        parent: "Admin"     },
};

interface TopbarProps {
  /** Solo se usa como fallback si la ruta no está en ROUTE_META */
  title?: string;
  subtitle?: string;
  tabs?: ReactNode;
}

export default function Topbar({ title, subtitle, tabs }: TopbarProps) {
  const pathname  = usePathname();
  const [initials, setInitials] = useState("··");

  const meta = ROUTE_META[pathname] ?? (title ? { label: title } : null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email ?? "";
      const parts = email.split("@")[0].split(/[._-]/);
      const inits = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
      setInitials(inits || email[0]?.toUpperCase() || "U");
    });
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-5 border-b border-white/[0.05] shrink-0"
      style={{
        height: "52px",
        background: "rgba(8,8,15,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* ── Izquierda: live badge + separador + breadcrumb + tabs ── */}
      <div className="flex items-center gap-3">
        {/* Connection status — live */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-slow opacity-40" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] text-emerald-400">live</span>
        </div>

        <div className="w-px h-4 bg-white/[0.08]" />

        {/* Breadcrumb — misma línea horizontal que mainFJ-hub */}
        {meta && (
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            {meta.parent && (
              <>
                <span className="text-slate-600">{meta.parent}</span>
                <ChevronRight size={12} className="text-slate-700" />
              </>
            )}
            <span className="text-slate-300 font-semibold">{meta.label}</span>
          </div>
        )}
        {/* Mobile: solo label */}
        {meta && (
          <span className="md:hidden text-sm font-semibold text-slate-300">{meta.label}</span>
        )}

        {/* Tabs opcionales */}
        {tabs && <div className="flex items-center gap-1 h-full ml-2">{tabs}</div>}
      </div>

      {/* ── Derecha: search + bell + avatar ── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]">
          <Search className="w-3 h-3" />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 bg-white/[0.08] rounded text-slate-600 font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>

        {/* User avatar — mismo estilo que mainFJ-hub */}
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400 select-none cursor-default">
          {initials}
        </div>
      </div>
    </header>
  );
}
