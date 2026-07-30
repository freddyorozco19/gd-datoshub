"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/* ── Mapa de rutas → breadcrumb (igual que mainFJ-hub ROUTE_META) ─────── */
const ROUTE_META: Record<string, { label: string; parent?: string }> = {
  "/dashboard":       { label: "Dashboard" },
  "/leads":           { label: "Leads",          parent: "Comercial" },
  "/productos":       { label: "Productos",      parent: "Comercial" },
  "/reuniones":       { label: "Reuniones",       parent: "Comercial" },
  "/integraciones":   { label: "Integraciones",   parent: "Sistemas"  },
  "/reportes":        { label: "Reportes",        parent: "Análisis"  },
  "/repositorios":    { label: "Repositorios",    parent: "Análisis"  },
  "/cmmi":            { label: "CMMI",            parent: "Análisis"  },
  "/certificaciones": { label: "Certificaciones", parent: "Análisis"  },
  "/usuarios":        { label: "Usuarios"                            },
};

interface TopbarProps {
  /** Solo se usa como fallback si la ruta no está en ROUTE_META */
  title?: string;
  subtitle?: string;
  tabs?: ReactNode;
}

export default function Topbar({ title, subtitle, tabs }: TopbarProps) {
  const pathname = usePathname();
  const meta     = ROUTE_META[pathname] ?? (title ? { label: title } : null);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        height: tabs ? "52px" : "52px",
        background: "rgba(8,8,15,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Izquierda: título + divisor + tabs ── */}
      <div className="flex items-center h-full gap-0">

        {/* Página actual */}
        {meta && (
          <div className="flex items-center gap-1.5 pr-4 shrink-0">
            {meta.parent && (
              <>
                <span className="hidden md:inline text-xs text-slate-600">{meta.parent}</span>
                <ChevronRight size={11} className="hidden md:inline text-slate-700" />
              </>
            )}
            <span className="text-sm font-semibold text-slate-200 tracking-tight">{meta.label}</span>
          </div>
        )}

        {/* Divisor vertical — solo si hay tabs */}
        {tabs && (
          <div className="w-px self-stretch mx-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        )}

        {/* Tabs — pegados al borde inferior del header */}
        {tabs && (
          <div className="flex items-end h-full pl-3 gap-0.5">
            {tabs}
          </div>
        )}
      </div>

      {/* ── Derecha: dot + search + bell ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-2 h-2 mr-1">
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-slow opacity-40" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]">
          <Search className="w-3 h-3" />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 bg-white/[0.08] rounded text-slate-600 font-mono">⌘K</kbd>
        </button>
        <button className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
