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

  const tabItems: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "usuarios",     label: "Usuarios",     icon: Users   },
    { id: "trazabilidad", label: "Trazabilidad", icon: History },
  ];

  const topbarTabs = (
    <>
      {tabItems.map(({ id, label, icon: Icon }) => {
        const active = id === tab;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors ${
              active
                ? "text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon size={13} />
            {label}
            {/* Underline indicator pegado al borde inferior */}
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full transition-all"
              style={{
                background: active ? "rgba(96,165,250,1)" : "transparent",
                boxShadow: active ? "0 0 8px rgba(96,165,250,0.6)" : "none",
              }}
            />
          </button>
        );
      })}
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Usuarios" subtitle="Gestión de cuentas, roles y trazabilidad de accesos · solo administradores" tabs={topbarTabs} />
      <main className="flex-1 p-6 space-y-5">
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

  const roles: { value: "user" | "admin"; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: "user",  label: "Usuario",        desc: "Acceso de lectura y análisis",        icon: <UserIcon size={15} /> },
    { value: "admin", label: "Administrador",  desc: "Gestión completa de usuarios y datos", icon: <Shield size={15} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={onClose}>
      {/* Liquid glass card */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.15)",
        }}
      >
        {/* Highlight stripe top */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.15))", border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 2px 8px rgba(59,130,246,0.2)" }}>
              <UserPlus size={16} className="text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Invitar usuario</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Se enviará un correo de invitación</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 text-slate-500 hover:text-slate-200">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))", border: "1px solid rgba(16,185,129,0.25)" }}>
                <Mail size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Invitación enviada</p>
                <p className="text-xs text-slate-400 mt-1">
                  <span className="text-slate-200">{email}</span> recibirá un correo con el link para activar su cuenta.
                </p>
              </div>
              <button onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl text-sm text-slate-300 transition-colors hover:text-white"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-2">Correo electrónico</label>
                <input
                  type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
                  }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(99,102,241,0.5)"; e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.2), 0 0 0 3px rgba(99,102,241,0.08)"; }}
                  onBlur={e =>  { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)"; e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.2)"; }}
                />
              </div>

              {/* Rol — cards */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => {
                    const active = role === r.value;
                    return (
                      <button type="button" key={r.value} onClick={() => setRole(r.value)}
                        className="relative flex flex-col items-start gap-1.5 rounded-xl px-4 py-3 text-left transition-all"
                        style={{
                          background: active
                            ? "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(59,130,246,0.15))"
                            : "rgba(255,255,255,0.04)",
                          border: active
                            ? "1px solid rgba(99,102,241,0.45)"
                            : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: active ? "0 0 0 3px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
                        }}>
                        {/* Check */}
                        {active && (
                          <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(99,102,241,0.8)" }}>
                            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="1.8">
                              <polyline points="1.5,5 4,7.5 8.5,2.5" />
                            </svg>
                          </span>
                        )}
                        <span className={active ? "text-indigo-300" : "text-slate-400"}>{r.icon}</span>
                        <span className={`text-sm font-medium leading-none ${active ? "text-white" : "text-slate-300"}`}>{r.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs text-rose-400"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !email}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
                    boxShadow: "0 2px 12px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                    border: "1px solid rgba(99,102,241,0.4)",
                  }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Enviar invitación
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Highlight stripe bottom */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
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

function generatePassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special),
    ...Array.from({ length: 8 }, () => rand(all))];
  return base.sort(() => Math.random() - 0.5).join("");
}

function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "Mínimo 10 caracteres",          ok: password.length >= 10 },
    { label: "Al menos una mayúscula",         ok: /[A-Z]/.test(password) },
    { label: "Al menos una minúscula",         ok: /[a-z]/.test(password) },
    { label: "Al menos un número",             ok: /[0-9]/.test(password) },
    { label: "Al menos un carácter especial",  ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passed = rules.filter(r => r.ok).length;
  const pct    = (passed / rules.length) * 100;
  const color  = passed <= 2 ? "#ef4444" : passed <= 3 ? "#f59e0b" : passed === 4 ? "#3b82f6" : "#10b981";
  const label  = passed <= 2 ? "Débil" : passed <= 3 ? "Regular" : passed === 4 ? "Buena" : "Fuerte";

  if (!password) return null;
  return (
    <div className="space-y-2">
      {/* Barra */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-[10px] font-medium tabular-nums" style={{ color }}>{label}</span>
      </div>
      {/* Checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map(r => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${r.ok ? "bg-emerald-500/20" : "bg-white/[0.04]"}`}>
              {r.ok
                ? <svg viewBox="0 0 10 10" className="w-2 h-2" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
                : <span className="w-1 h-1 rounded-full bg-white/20" />}
            </span>
            <span className={`text-[10px] leading-tight ${r.ok ? "text-slate-400" : "text-slate-600"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  const rules = [
    password.length >= 10,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const allRules  = rules.every(Boolean);
  const matches   = password === confirm && confirm.length > 0;
  const canSubmit = allRules && matches && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRules) { setError("La contraseña no cumple todos los requisitos."); return; }
    if (!matches)  { setError("Las contraseñas no coinciden."); return; }
    setError(null); setLoading(true);
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

  function applyGenerated() {
    const p = generatePassword();
    setPassword(p); setConfirm(p); setShowPw(true); setShowCf(true);
  }

  const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all pr-10"
  const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.04) 100%)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12)" }}>
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,88,12,0.15))", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 2px 8px rgba(245,158,11,0.2)" }}>
              <KeyRound size={16} className="text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Cambiar contraseña</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[190px]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white">Contraseña actualizada</p>
              <p className="text-xs text-slate-400">Los cambios se aplicarán en el próximo inicio de sesión.</p>
              <button onClick={onClose} className="mt-1 px-5 py-2 rounded-xl text-sm text-slate-300 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Botón generar */}
              <button type="button" onClick={applyGenerated}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-amber-300 transition-all hover:text-amber-200"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.3)" }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
                Generar contraseña segura
              </button>

              {/* Nueva contraseña */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Nueva contraseña</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoFocus value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Mínimo 10 caracteres"
                    className={inputCls} style={inputStyle} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs">
                    {showPw ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              {/* Confirmar */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Confirmar contraseña</label>
                <div className="relative">
                  <input type={showCf ? "text" : "password"} value={confirm}
                    onChange={e => setConfirm(e.target.value)} placeholder="Repite la contraseña"
                    className={inputCls} style={{ ...inputStyle, borderColor: confirm ? (matches ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.09)" }} />
                  <button type="button" onClick={() => setShowCf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs">
                    {showCf ? "Ocultar" : "Ver"}
                  </button>
                </div>
                {confirm && (
                  <p className={`text-[10px] ${matches ? "text-emerald-400" : "text-rose-400"}`}>
                    {matches ? "✓ Las contraseñas coinciden" : "✗ Las contraseñas no coinciden"}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs text-rose-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!canSubmit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-40 transition-all"
                  style={{ background: "linear-gradient(135deg,#d97706,#b45309)", boxShadow: canSubmit ? "0 2px 12px rgba(217,119,6,0.35),inset 0 1px 0 rgba(255,255,255,0.12)" : "none", border: "1px solid rgba(245,158,11,0.4)" }}>
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
