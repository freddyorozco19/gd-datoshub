"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Plug2,
  BarChart3,
  FolderOpen,
  ShieldCheck,
  LogOut,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard",    href: "/dashboard",     icon: LayoutDashboard },
  { label: "Leads",        href: "/leads",          icon: Users },
  { label: "Reuniones",    href: "/reuniones",      icon: CalendarDays },
  { label: "Integraciones",href: "/integraciones",  icon: Plug2 },
  { label: "Reportes",     href: "/reportes",       icon: BarChart3 },
  { label: "Repositorios", href: "/repositorios",   icon: FolderOpen },
  { label: "CMMI",         href: "/cmmi",           icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out shrink-0 ${
        collapsed ? "w-[60px]" : "w-56"
      }`}
    >
      {/* ── Header / Logo + botón colapsar ── */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 shrink-0">
            <Database size={15} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              GD-DatosHub
            </span>
          )}
        </div>

        <button
          onClick={() => setCollapsed((p) => !p)}
          title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {collapsed
            ? <PanelLeftOpen  size={16} />
            : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── Navegación ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="px-2 pb-3 pt-2 border-t border-slate-700">
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
