"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Plug2,
  BarChart3,
  FolderOpen,
  ShieldCheck,
  UserCog,
  BookOpen,
  LogOut,
  ChevronDown,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Estructura de navegación por secciones ──────────────────────────── */
interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}
interface NavSection {
  id: string;
  header: string | null;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    id: "general",
    header: null,
    items: [
      { label: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard },
      { label: "Leads",         href: "/leads",         icon: Users },
      { label: "Reuniones",     href: "/reuniones",     icon: CalendarDays },
      { label: "Integraciones", href: "/integraciones", icon: Plug2 },
    ],
  },
  {
    id: "analisis",
    header: "Análisis",
    items: [
      { label: "Reportes",          href: "/reportes",        icon: BarChart3 },
      { label: "Repositorios",      href: "/repositorios",    icon: FolderOpen },
      { label: "CMMI",              href: "/cmmi",            icon: ShieldCheck },
      { label: "Certificaciones",   href: "/certificaciones", icon: BookOpen },
    ],
  },
  {
    id: "admin",
    header: "Administración",
    items: [
      { label: "Usuarios",      href: "/usuarios",      icon: UserCog, adminOnly: true },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [email, setEmail]         = useState<string>("");
  const [query, setQuery]         = useState("");
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = (user?.app_metadata as { role?: string } | undefined)?.role;
      setIsAdmin(role === "admin");
      setEmail(user?.email ?? "");
    });
  }, []);

  // Atajo ⌘K / Ctrl+K → enfocar buscador
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (collapsed) setCollapsed(false);
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleSection(id: string) {
    setClosedSections((p) => ({ ...p, [id]: !p[id] }));
  }

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Secciones filtradas por rol + búsqueda
  const sections = useMemo(() => {
    return SECTIONS
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (it) => (!it.adminOnly || isAdmin) && (!searching || it.label.toLowerCase().includes(q))
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [isAdmin, searching, q]);

  const initials = email
    ? email.split("@")[0].split(/[.\-_]/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")
    : "·";

  return (
    <aside
      className={`sidebar-font flex flex-col h-screen bg-[#0a0b0f] text-white border-r border-white/[0.06] transition-all duration-300 ease-in-out shrink-0 ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      {/* ── Brand / workspace ── */}
      <div className="flex items-center gap-2 px-3 py-3.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 shrink-0">
            <Image
              src="/growdata-icon.webp"
              alt="GrowData"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sm font-semibold tracking-tight text-white truncate">GD-DatosHub</span>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((p) => !p)}
          title={collapsed ? "Expandir" : "Colapsar"}
          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── Buscador ── */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-2 focus-within:border-blue-500/50 focus-within:bg-white/[0.06] transition-colors">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="flex-1 min-w-0 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
            {query ? (
              <button onClick={() => setQuery("")} className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0">esc</button>
            ) : (
              <span className="flex items-center gap-0.5 shrink-0">
                <kbd className="text-[9px] font-medium text-slate-500 bg-white/[0.06] rounded px-1 py-0.5 leading-none">⌘</kbd>
                <kbd className="text-[9px] font-medium text-slate-500 bg-white/[0.06] rounded px-1 py-0.5 leading-none">K</kbd>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Navegación ── */}
      <nav className="sidebar-scroll flex-1 px-2 py-1.5 space-y-3 overflow-y-auto">
        {sections.map((sec) => {
          const closed = !searching && !!closedSections[sec.id];
          return (
            <div key={sec.id} className="space-y-0.5">
              {sec.header && !collapsed && (
                <button
                  onClick={() => toggleSection(sec.id)}
                  className="flex items-center justify-between w-full px-2.5 pt-1 pb-1 group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors">
                    {sec.header}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-600 group-hover:text-slate-400 transition-all ${closed ? "-rotate-90" : ""}`}
                  />
                </button>
              )}
              {sec.header && collapsed && <div className="h-px bg-white/[0.06] mx-2 my-1.5" />}

              {!closed && sec.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-gradient-to-r from-transparent via-blue-800/40 to-blue-500 text-white"
                        : "text-slate-200 hover:bg-white/[0.05] hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon size={18} className={`shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {active && (
                      <span className="absolute right-[-7px] top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-blue-300 shadow-[0_0_8px_1px_rgba(147,197,253,0.9)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {searching && sections.length === 0 && (
          <p className="px-3 py-4 text-xs text-slate-500 text-center">Sin coincidencias</p>
        )}
      </nav>

      {/* ── Footer: usuario + logout ── */}
      <div className="px-2 py-2.5 border-t border-white/[0.06] space-y-1.5">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-[11px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate" title={email}>{email || "—"}</p>
              <p className="text-[10px] text-slate-500">{isAdmin ? "Administrador" : "Usuario"}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-[11px] font-bold text-white" title={email}>
              {initials}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={`flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/[0.05] hover:text-rose-300 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
