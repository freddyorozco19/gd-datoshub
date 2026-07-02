"use client";

import Link, { useLinkStatus } from "next/link";
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
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

/* Spinner que reacciona al estado de navegación del Link contenedor */
function NavSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      size={13}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-blue-300"
    />
  );
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

type SidebarMode = "expanded" | "collapsed" | "hover";
const MODE_ORDER: SidebarMode[] = ["expanded", "collapsed", "hover"];
const MODE_LABEL: Record<SidebarMode, string> = {
  expanded:  "Expandido",
  collapsed: "Colapsado",
  hover:     "Hover",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [mode, setMode]       = useState<SidebarMode>("expanded");
  const [hovered, setHovered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail]     = useState<string>("");
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

  // En modo hover el sidebar se expande solo al pasar el cursor
  const collapsed = mode === "collapsed" || (mode === "hover" && !hovered);
  // El espacio reservado en el layout (footprint): hover y collapsed ocupan 68px
  const footprintW = mode === "expanded" ? 200 : 60;
  const overlaying = mode === "hover" && hovered;

  function cycleMode() {
    setMode((m) => MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length]);
  }

  // Persistencia de la preferencia de modo
  useEffect(() => {
    const saved = localStorage.getItem("sidebarMode") as SidebarMode | null;
    if (saved && MODE_ORDER.includes(saved)) setMode(saved);
  }, []);
  useEffect(() => { localStorage.setItem("sidebarMode", mode); }, [mode]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = (user?.app_metadata as { role?: string } | undefined)?.role;
      setIsAdmin(role === "admin");
      setEmail(user?.email ?? "");
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleSection(id: string) {
    setClosedSections((p) => ({ ...p, [id]: !p[id] }));
  }

  // Secciones filtradas por rol
  const sections = useMemo(() => {
    return SECTIONS
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => !it.adminOnly || isAdmin),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [isAdmin]);

  const initials = email
    ? email.split("@")[0].split(/[.\-_]/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")
    : "·";

  const ModeIcon = mode === "expanded" ? PanelLeftClose : mode === "collapsed" ? PanelLeftOpen : PanelLeft;

  return (
    <div className="relative shrink-0 h-screen transition-all duration-300 ease-in-out" style={{ width: footprintW }}>
      <aside
        onMouseEnter={() => mode === "hover" && setHovered(true)}
        onMouseLeave={() => mode === "hover" && setHovered(false)}
        className={`sidebar-font flex flex-col h-screen bg-[#0e0e1c] text-white border-r border-white/[0.06] transition-all duration-300 ease-in-out ${
          collapsed ? "w-[60px]" : "w-[200px]"
        } ${mode === "hover" ? `absolute inset-y-0 left-0 z-40 ${overlaying ? "shadow-2xl shadow-black/60" : ""}` : "h-screen"}`}
      >
      {/* ── Brand / workspace ── */}
      <div className={`flex items-center gap-2 px-3 py-3.5 ${collapsed ? "justify-center" : ""}`}>
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "" : "flex-1"}`}>
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
            <span className="text-sm font-semibold tracking-tight text-white truncate">GD-DatosHub</span>
          )}
        </div>
      </div>

      {/* ── Navegación ── */}
      <nav className="sidebar-scroll flex-1 px-2 py-1.5 space-y-3 overflow-y-auto">
        {sections.map((sec) => {
          const closed = !!closedSections[sec.id];
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
                    className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-[11px] font-light transition-all ${
                      active
                        ? "bg-gradient-to-r from-transparent via-blue-800/40 to-blue-500 text-white"
                        : "text-slate-200 hover:bg-white/[0.05] hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon size={18} className={`shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                    <NavSpinner />
                    {active && (
                      <span className="absolute right-[-7px] top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-blue-300 shadow-[0_0_8px_1px_rgba(147,197,253,0.9)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Footer: modo + usuario + logout ── */}
      <div className="px-2 py-2.5 border-t border-white/[0.06] space-y-1.5">
        <button
          onClick={cycleMode}
          title={`Vista: ${MODE_LABEL[mode]} · clic para cambiar`}
          className={`flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-[11px] font-medium text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ModeIcon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Vista · {MODE_LABEL[mode]}</span>}
        </button>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-[11px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-200 truncate" title={email}>{email || "—"}</p>
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
          className={`flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-[11px] font-medium text-slate-400 hover:bg-white/[0.05] hover:text-rose-300 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>
      </aside>
    </div>
  );
}
