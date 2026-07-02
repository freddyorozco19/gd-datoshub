"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, Plug2, BarChart3,
  FolderOpen, ShieldCheck, BookOpen, UserCog, LogOut, Zap,
  ChevronDown, PanelLeftClose, PanelLeftOpen, PanelLeft, Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";


/* ── Estructura de navegación ─────────────────────────────────────────────── */
interface NavItem  { label: string; href: string; icon: typeof LayoutDashboard; adminOnly?: boolean }
interface NavSection { id: string; header: string | null; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    id: "general",
    header: null,
    items: [
      { label: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard },
      { label: "Leads",         href: "/leads",         icon: Users           },
      { label: "Reuniones",     href: "/reuniones",     icon: CalendarDays    },
      { label: "Integraciones", href: "/integraciones", icon: Plug2           },
    ],
  },
  {
    id: "analisis",
    header: "Análisis",
    items: [
      { label: "Reportes",        href: "/reportes",        icon: BarChart3   },
      { label: "Repositorios",    href: "/repositorios",    icon: FolderOpen  },
      { label: "CMMI",            href: "/cmmi",            icon: ShieldCheck },
      { label: "Certificaciones", href: "/certificaciones", icon: BookOpen    },
    ],
  },
  {
    id: "admin",
    header: "Administración",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: UserCog, adminOnly: true },
    ],
  },
];

/* ── Spinner de navegación ────────────────────────────────────────────────── */
function NavSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/60" />;
}

/* ── Modos ────────────────────────────────────────────────────────────────── */
type SidebarMode = "expanded" | "collapsed" | "hover";
const MODE_ORDER: SidebarMode[] = ["expanded", "collapsed", "hover"];
const MODE_LABEL: Record<SidebarMode, string> = { expanded: "Expandido", collapsed: "Colapsado", hover: "Hover" };

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [mode, setMode]             = useState<SidebarMode>("expanded");
  const [hovered, setHovered]       = useState(false);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [email, setEmail]           = useState("");
  const [displayName, setDisplay]   = useState("");
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
  const [avatarOpen, setAvatarOpen] = useState(false);

  const collapsed  = mode === "collapsed" || (mode === "hover" && !hovered);
  const footprintW = mode === "expanded" ? 220 : 64;
  const overlaying = mode === "hover" && hovered;

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
      const e = user?.email ?? "";
      setEmail(e);
      const parts = e.split("@")[0].split(/[._-]/);
      setDisplay(parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" "));
    });
  }, []);

  useEffect(() => {
    if (!avatarOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-avatar-menu]")) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [avatarOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = email
    ? email.split("@")[0].split(/[.\-_]/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")
    : "··";

  const sections = useMemo(() =>
    SECTIONS
      .map((sec) => ({ ...sec, items: sec.items.filter((it) => !it.adminOnly || isAdmin) }))
      .filter((sec) => sec.items.length > 0),
    [isAdmin],
  );

  return (
    <div className="relative shrink-0 h-screen transition-all duration-300 ease-in-out" style={{ width: footprintW }}>
      <aside
        onMouseEnter={() => mode === "hover" && setHovered(true)}
        onMouseLeave={() => mode === "hover" && setHovered(false)}
        style={{ background: "rgba(8,8,15,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        className={`flex flex-col h-screen text-white border-r border-white/[0.06] transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-[220px]"
        } ${mode === "hover" ? `absolute inset-y-0 left-0 z-40 ${overlaying ? "shadow-2xl shadow-black/60" : ""}` : ""}`}
      >
        {/* ── Brand ── */}
        <div className={`flex items-center gap-2 px-3 py-3.5 ${collapsed ? "justify-center" : ""}`}>
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "" : "flex-1"}`}>
            <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-violet-600 shadow-[0_0_12px_rgba(124,58,237,0.4)]">
              <Zap size={14} className="text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-wide text-white truncate block">GD-DatosHub</span>
                <span className="text-[9px] text-slate-600 tracking-widest uppercase">GrowData</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Navegación ── */}
        <nav className="sidebar-scroll flex-1 px-2 py-1.5 space-y-3 overflow-y-auto">
          {sections.map((sec) => {
            const closed = !!closedSections[sec.id];
            return (
              <div key={sec.id} className="space-y-0.5">
                {/* Section header */}
                {sec.header && !collapsed && (
                  <button
                    onClick={() => setClosedSections((p) => ({ ...p, [sec.id]: !p[sec.id] }))}
                    className="flex items-center justify-between w-full px-2.5 pt-1 pb-1 group"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors">
                      {sec.header}
                    </span>
                    <ChevronDown size={12} className={`text-slate-600 group-hover:text-slate-400 transition-all ${closed ? "-rotate-90" : ""}`} />
                  </button>
                )}
                {sec.header && collapsed && <div className="h-px bg-white/[0.06] mx-2 my-1.5" />}

                {/* Nav items */}
                {!closed && sec.items.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium tracking-tight transition-all ${
                        active
                          ? "bg-gradient-to-r from-transparent via-blue-800/40 to-blue-500 text-white"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon
                        size={16}
                        className={`shrink-0 transition-colors ${active ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}
                      />
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

        {/* ── Footer ── */}
        <div className="relative px-2 py-2.5 border-t border-white/[0.06]" data-avatar-menu>
          {/* Menú del avatar */}
          {avatarOpen && (
            <div className={`absolute bottom-full mb-2 ${collapsed ? "left-1/2 -translate-x-1/2 w-44" : "left-0 right-0"} bg-[#15151f] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50`}>
              {!collapsed && (
                <div className="px-3 py-2.5 border-b border-white/[0.06]">
                  <p className="text-xs font-medium text-slate-200 truncate">{displayName || email}</p>
                  <p className="text-[10px] text-slate-500">{isAdmin ? "Administrador" : "Usuario"}</p>
                </div>
              )}
              {MODE_ORDER.map((m) => {
                const Icon = m === "expanded" ? PanelLeftClose : m === "collapsed" ? PanelLeftOpen : PanelLeft;
                return (
                  <button key={m} onClick={() => { setMode(m); setAvatarOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      mode === m ? "text-blue-300 bg-blue-500/10" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}>
                    <Icon size={14} className="shrink-0" />
                    <span>Vista {MODE_LABEL[m]}</span>
                  </button>
                );
              })}
              <div className="h-px bg-white/[0.06] mx-2" />
              <button onClick={() => { setAvatarOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.05] hover:text-rose-300 transition-colors">
                <LogOut size={14} className="shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}

          {/* Avatar clickeable */}
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className={`flex w-full items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? email : undefined}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-200 truncate">{displayName || email.split("@")[0]}</p>
                <p className="text-[10px] text-slate-500">{isAdmin ? "Administrador" : "Usuario"}</p>
              </div>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}
