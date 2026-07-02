"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, Plug2, BarChart3,
  FolderOpen, ShieldCheck, BookOpen, UserCog, LogOut,
  PanelLeftClose, PanelLeft, PanelLeftOpen, Zap, Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLinkStatus } from "next/link";

/* ── Colores por ruta (igual que MODULE_COLORS en mainFJ-hub) ────────────── */
const ROUTE_COLORS: Record<string, { icon: string; bg: string }> = {
  "/dashboard":       { icon: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  "/leads":           { icon: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20"  },
  "/reuniones":       { icon: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20"      },
  "/integraciones":   { icon: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20"      },
  "/reportes":        { icon: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20"  },
  "/repositorios":    { icon: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20"    },
  "/cmmi":            { icon: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20"  },
  "/certificaciones": { icon: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/20"      },
  "/usuarios":        { icon: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20"    },
};

/* ── Nav sections ─────────────────────────────────────────────────────────── */
interface NavItem { label: string; href: string; icon: typeof LayoutDashboard; adminOnly?: boolean }
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
  return (
    <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-violet-300 flex-shrink-0" />
  );
}

/* ── Modos del sidebar ────────────────────────────────────────────────────── */
type SidebarMode = "expanded" | "collapsed" | "hover";
const MODE_ORDER: SidebarMode[] = ["expanded", "collapsed", "hover"];
const MODE_LABEL: Record<SidebarMode, string> = { expanded: "Expandido", collapsed: "Colapsado", hover: "Hover" };

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [mode, setMode]           = useState<SidebarMode>("expanded");
  const [hovered, setHovered]     = useState(false);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [email, setEmail]         = useState("");
  const [displayName, setDisplay] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);

  const collapsed  = mode === "collapsed" || (mode === "hover" && !hovered);
  const footprintW = mode === "expanded" ? 220 : 64;
  const overlaying = mode === "hover" && hovered;

  /* Persistencia del modo */
  useEffect(() => {
    const saved = localStorage.getItem("sidebarMode") as SidebarMode | null;
    if (saved && MODE_ORDER.includes(saved)) setMode(saved);
  }, []);
  useEffect(() => { localStorage.setItem("sidebarMode", mode); }, [mode]);

  /* Usuario */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = (user?.app_metadata as { role?: string } | undefined)?.role;
      setIsAdmin(role === "admin");
      const e = user?.email ?? "";
      setEmail(e);
      const raw = e.split("@")[0].split(/[._-]/);
      const name = raw.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      setDisplay(name);
    });
  }, []);

  /* Cerrar avatar menu al hacer clic fuera */
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

  /* Iniciales del avatar */
  const initials = email
    ? email.split("@")[0].split(/[.\-_]/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")
    : "··";

  /* Secciones filtradas por rol */
  const sections = useMemo(() =>
    SECTIONS
      .map((sec) => ({ ...sec, items: sec.items.filter((it) => !it.adminOnly || isAdmin) }))
      .filter((sec) => sec.items.length > 0),
    [isAdmin],
  );

  const ModeIcon = mode === "expanded" ? PanelLeftClose : mode === "collapsed" ? PanelLeftOpen : PanelLeft;

  return (
    <div className="relative shrink-0 h-screen transition-all duration-300 ease-in-out" style={{ width: footprintW }}>
      <aside
        onMouseEnter={() => mode === "hover" && setHovered(true)}
        onMouseLeave={() => mode === "hover" && setHovered(false)}
        className={`flex flex-col h-screen border-r border-white/[0.05] transition-all duration-300 ease-in-out z-40 ${
          collapsed ? "w-16" : "w-[220px]"
        } ${mode === "hover" ? `absolute inset-y-0 left-0 ${overlaying ? "shadow-2xl shadow-black/60" : ""}` : ""}`}
        style={{ background: "linear-gradient(180deg, #07070E 0%, #0A0A18 50%, #07070E 100%)" }}
      >
        {/* ── Logo / Brand ── */}
        <div className={`flex items-center border-b border-white/[0.05] flex-shrink-0 ${collapsed ? "justify-center px-3 py-4" : "gap-3 px-4 py-4"}`}>
          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.5)]">
                <Zap size={12} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white tracking-wide leading-none truncate">GD-DatosHub</div>
                <div className="text-[9px] text-slate-600 tracking-widest uppercase mt-0.5">GrowData</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.5)]">
              <Zap size={14} className="text-white" />
            </div>
          )}
          <button
            onClick={() => setMode((m) => MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length])}
            className="flex-shrink-0 flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] rounded-lg transition-colors"
            title={`Vista: ${MODE_LABEL[mode]}`}
          >
            <ModeIcon size={14} />
          </button>
        </div>

        {/* ── Navegación ── */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 sidebar-scroll">
          {sections.map((sec, si) => (
            <div key={sec.id}>
              {si > 0 && (
                <div className="px-4 mb-1">
                  <div className="h-px bg-white/[0.05]" />
                </div>
              )}
              {sec.header && !collapsed && (
                <div className="px-4 mb-1.5">
                  <span className="section-label">{sec.header}</span>
                </div>
              )}
              <div className={`space-y-0.5 ${collapsed ? "px-2" : "px-2"}`}>
                {sec.items.map(({ label, href, icon: Icon }) => {
                  const active  = pathname === href || pathname.startsWith(href + "/");
                  const colors  = ROUTE_COLORS[href] ?? { icon: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" };
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? "bg-white/[0.06] border border-white/[0.08] text-white"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                      } ${collapsed ? "justify-center" : ""}`}
                      style={active ? { boxShadow: "0 0 20px rgba(124,58,237,0.1)" } : undefined}
                    >
                      {/* Icon box */}
                      <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-200 ${
                        active
                          ? `${colors.bg}`
                          : `bg-white/[0.03] border-white/[0.05] group-hover:${colors.bg}`
                      }`}>
                        <Icon size={14} className={active ? colors.icon : `text-slate-600 group-hover:${colors.icon} transition-colors`} />
                      </div>
                      {!collapsed && (
                        <span className="flex-1 truncate tracking-tight">{label}</span>
                      )}
                      {!collapsed && active && (
                        <div className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                      )}
                      <NavSpinner />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-white/[0.05]" data-avatar-menu>
          {/* Menú del avatar */}
          {avatarOpen && (
            <div className={`absolute bottom-full mb-1 ${collapsed ? "left-full ml-2 bottom-4" : "left-2 right-2"} bg-[#0D0D1A] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50`}>
              <div className="px-3 py-2.5 border-b border-white/[0.06]">
                <p className="text-[11px] font-medium text-slate-200 truncate">{displayName || email}</p>
                <p className="text-[10px] text-slate-500">{isAdmin ? "Administrador" : "Usuario"}</p>
              </div>
              {MODE_ORDER.map((m) => {
                const Icon = m === "expanded" ? PanelLeftClose : m === "collapsed" ? PanelLeftOpen : PanelLeft;
                return (
                  <button key={m} onClick={() => { setMode(m); setAvatarOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-[11px] transition-colors ${
                      mode === m ? "text-violet-300 bg-violet-500/10" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}>
                    <Icon size={14} className="shrink-0" />
                    <span>Vista {MODE_LABEL[m]}</span>
                  </button>
                );
              })}
              <div className="h-px bg-white/[0.06] mx-2" />
              <button onClick={() => { setAvatarOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-slate-400 hover:bg-white/[0.05] hover:text-rose-300 transition-colors">
                <LogOut size={14} className="shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}

          {/* Tarjeta de usuario expandida (igual que mainFJ-hub) */}
          {!collapsed && (
            <div className="px-3 pt-3 pb-2">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-400 flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-300 truncate">{displayName || email.split("@")[0]}</span>
                    <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold bg-violet-500/15 border border-violet-500/25 text-violet-400">
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">{email}</div>
                </div>
              </button>
            </div>
          )}

          {/* Footer colapsado — solo avatar */}
          {collapsed && (
            <div className="flex justify-center py-3">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-400 hover:bg-violet-500/30 transition-colors"
                title={email}
              >
                {initials}
              </button>
            </div>
          )}

          {/* Logout rápido solo visible expandido, fuera del menú */}
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1.5 px-1">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-slow opacity-40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] text-slate-600">live</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={13} />
                <span className="text-xs">Salir</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
