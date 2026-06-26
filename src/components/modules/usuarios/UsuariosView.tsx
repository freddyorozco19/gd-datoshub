"use client";

import { useEffect, useState } from "react";
import {
  Users, Shield, User as UserIcon, Loader2, AlertCircle, RefreshCw, Clock,
  History, Globe, Monitor, CheckCircle2, XCircle, UserPlus, X, Mail, Trash2, KeyRound,
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
        <div className="flex items-center gap-1.5 border-b border-white/[0.07]">
          {([
            { id: "usuarios" as Tab,     label: "Usuarios",     icon: Users   },
            { id: "trazabilidad" as Tab, label: "Trazabilidad", icon: History },
          ]).map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
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

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setDone(true);
      onSuccess(email.trim().toLowerCase());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al invitar usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <UserPlus size={15} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Invitar usuario</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Se enviará un correo de invitación</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Mail size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Invitación enviada</p>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="text-slate-300">{email}</span> recibirá un correo con un link para activar su cuenta.
                </p>
              </div>
              <button onClick={onClose} className="mt-2 px-5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-slate-300 transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Rol</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as "user" | "admin")}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-400">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium disabled:opacity-60 transition-colors"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Enviar invitación
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({
  user, onClose, onDeleted,
}: { user: UserRow; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      onDeleted(user.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Trash2 size={15} className="text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Eliminar usuario</h3>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-400">
            ¿Seguro que quieres eliminar a <span className="text-slate-200 font-medium">{user.email}</span>? Esta acción no se puede deshacer.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm text-white font-medium disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <KeyRound size={15} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Cambiar contraseña</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm text-slate-300">Contraseña actualizada correctamente.</p>
              <button onClick={onClose} className="mt-2 px-5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-slate-300 transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Nueva contraseña</label>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-400">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm text-white font-medium disabled:opacity-60 transition-colors"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Cambiar contraseña
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function UsuariosPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);

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
        <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm">
          <Users size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">{users.length}</span>
          <span className="text-slate-500">usuarios</span>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm">
          <Shield size={16} className="text-violet-400" />
          <span className="font-semibold text-slate-200">{admins}</span>
          <span className="text-slate-500">administradores</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
          >
            <UserPlus size={13} /> Nuevo usuario
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.07] hover:bg-white/[0.05] disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); load(); }}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={(id) => { setUsers((prev) => prev.filter((u) => u.id !== id)); setDeletingUser(null); }}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
                {["Usuario", "Rol", "Último ingreso", "Creado", "Acción"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={20} className="animate-spin inline" /> <span className="ml-2 align-middle">Cargando usuarios…</span>
                </td></tr>
              )}
              {!loading && users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${u.role === "admin" ? "bg-violet-500/10 text-violet-400" : "bg-white/[0.05] text-slate-400"}`}>
                        {u.role === "admin" ? <Shield size={15} /> : <UserIcon size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 truncate">{u.email}</p>
                        {u.isSelf && <span className="text-[11px] text-blue-400">tú</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-violet-500/10 text-violet-400" : "bg-white/[0.05] text-slate-400"}`}>
                      {u.role === "admin" ? "Administrador" : "Usuario"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Clock size={12} /> {fmtDate(u.lastSignInAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        disabled={savingId === u.id || u.isSelf}
                        onChange={(e) => changeRole(u, e.target.value as "admin" | "user")}
                        title={u.isSelf ? "No puedes cambiar tu propio rol" : "Cambiar rol"}
                        className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                      {savingId === u.id && <Loader2 size={14} className="animate-spin text-slate-500" />}
                      <button
                        onClick={() => setResettingUser(u)}
                        title="Cambiar contraseña"
                        className="p-1.5 rounded-lg text-slate-500 border border-white/[0.07] hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                      >
                        <KeyRound size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)}
                        disabled={u.isSelf}
                        title={u.isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                        className="p-1.5 rounded-lg text-slate-500 border border-white/[0.07] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && !error && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No hay usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600">
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
        <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm">
          <History size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">{events.length}</span>
          <span className="text-slate-500">eventos de acceso</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.07] hover:bg-white/[0.05] disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          La tabla de trazabilidad aún no está creada en Supabase. Una vez creada, los inicios de sesión se registrarán automáticamente aquí.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
                {["Fecha / Hora", "Email", "Acción", "IP", "Navegador", "SO", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={20} className="animate-spin inline" /> <span className="ml-2 align-middle">Cargando trazabilidad…</span>
                </td></tr>
              )}
              {!loading && events.map((ev) => (
                <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap tabular-nums">{fmtDateTime(ev.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-300 max-w-[220px] truncate" title={ev.email ?? ""}>{ev.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      {ev.action === "login" ? "Inicio de sesión" : ev.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Globe size={12} className="text-slate-600" /> {ev.ip || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{ev.browser || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Monitor size={12} className="text-slate-600" /> {ev.os || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {ev.status === "success" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400"><CheckCircle2 size={13} /> Éxito</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-rose-400"><XCircle size={13} /> Error</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && !error && !needsSetup && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Aún no hay registros de acceso.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Cada inicio de sesión en la plataforma queda registrado automáticamente con fecha, IP, navegador y sistema operativo.
      </p>
    </div>
  );
}
