"use client";

import { useEffect, useState } from "react";
import {
  Users, Shield, User as UserIcon, Loader2, AlertCircle, RefreshCw, Clock,
  History, Globe, Monitor, CheckCircle2, XCircle,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

interface UserRow {
  id: string;
  email: string;
  role: "admin" | "user";
  lastSignInAt: string | null;
  createdAt: string | null;
  isSelf: boolean;
}

interface AccessEvent {
  id: string;
  created_at: string;
  email: string | null;
  action: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  status: string;
}

const fmtDate = (s: string | null): string =>
  s ? new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "nunca";

const fmtDateTime = (s: string): string =>
  new Date(s).toLocaleString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

type Tab = "usuarios" | "trazabilidad";

export default function UsuariosView() {
  const [tab, setTab] = useState<Tab>("usuarios");

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Usuarios" subtitle="Gestión de cuentas, roles y trazabilidad de accesos · solo administradores" />
      <main className="flex-1 p-6 space-y-5">
        {/* Sub-navegación */}
        <div className="flex items-center gap-1.5 border-b border-slate-200">
          {([
            { id: "usuarios" as Tab,     label: "Usuarios",      icon: Users },
            { id: "trazabilidad" as Tab, label: "Trazabilidad",  icon: History },
          ]).map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>

        {tab === "usuarios" ? <UsuariosPanel /> : <TrazabilidadPanel />}
      </main>
    </div>
  );
}

function UsuariosPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setUsers(json.users as UserRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function changeRole(u: UserRow, role: "admin" | "user") {
    if (role === u.role) return;
    setSavingId(u.id); setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el rol.");
    } finally {
      setSavingId(null);
    }
  }

  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-5">
        {/* Resumen */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
            <Users size={16} className="text-blue-600" />
            <span className="font-semibold text-slate-800">{users.length}</span>
            <span className="text-slate-500">usuarios</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
            <Shield size={16} className="text-violet-600" />
            <span className="font-semibold text-slate-800">{admins}</span>
            <span className="text-slate-500">administradores</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Usuario", "Rol", "Último ingreso", "Creado", "Acción"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 size={20} className="animate-spin inline" /> <span className="ml-2 align-middle">Cargando usuarios…</span>
                  </td></tr>
                )}
                {!loading && users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${u.role === "admin" ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500"}`}>
                          {u.role === "admin" ? <Shield size={15} /> : <UserIcon size={15} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{u.email}</p>
                          {u.isSelf && <span className="text-[11px] text-blue-600">tú</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                        {u.role === "admin" ? "Administrador" : "Usuario"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock size={12} /> {fmtDate(u.lastSignInAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          disabled={savingId === u.id || u.isSelf}
                          onChange={(e) => changeRole(u, e.target.value as "admin" | "user")}
                          title={u.isSelf ? "No puedes cambiar tu propio rol" : "Cambiar rol"}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Administrador</option>
                        </select>
                        {savingId === u.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && !error && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">No hay usuarios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Los roles se almacenan de forma segura en Supabase (app_metadata) y solo pueden modificarse desde aquí por un administrador.
        </p>
    </div>
  );
}

/* ── Trazabilidad de accesos ───────────────────────────────────────── */
function TrazabilidadPanel() {
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  async function load() {
    setLoading(true); setError(null); setNeedsSetup(false);
    try {
      const res = await fetch("/api/admin/access-log");
      const json = await res.json();
      if (!res.ok) {
        if (json.needsSetup) { setNeedsSetup(true); return; }
        throw new Error(json.error || `Error ${res.status}`);
      }
      setEvents((json.events ?? []) as AccessEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la trazabilidad.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
          <History size={16} className="text-blue-600" />
          <span className="font-semibold text-slate-800">{events.length}</span>
          <span className="text-slate-500">eventos de acceso</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          La tabla de trazabilidad aún no está creada en Supabase. Una vez creada, los inicios de sesión se registrarán automáticamente aquí.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Fecha / Hora", "Email", "Acción", "IP", "Navegador", "SO", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Loader2 size={20} className="animate-spin inline" /> <span className="ml-2 align-middle">Cargando trazabilidad…</span>
                </td></tr>
              )}
              {!loading && events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap tabular-nums">{fmtDateTime(ev.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[220px] truncate" title={ev.email ?? ""}>{ev.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {ev.action === "login" ? "Inicio de sesión" : ev.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Globe size={12} className="text-slate-400" /> {ev.ip || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{ev.browser || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Monitor size={12} className="text-slate-400" /> {ev.os || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {ev.status === "success" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={13} /> Éxito</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-rose-600"><XCircle size={13} /> Error</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && !error && !needsSetup && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Aún no hay registros de acceso.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Cada inicio de sesión en la plataforma queda registrado automáticamente con fecha, IP, navegador y sistema operativo.
      </p>
    </div>
  );
}
