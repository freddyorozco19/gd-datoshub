"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Database, Loader2, Lock, CheckCircle2 } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // El SDK procesa el access_token/refresh_token del hash de la URL al inicializarse
    // (detectSessionInUrl). onAuthStateChange cubre el caso en que esa detección termine
    // después del primer getSession(); getSession() cubre el caso en que ya haya terminado.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setChecking(false);
      if (session && typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setHasSession(true); setChecking(false); }
    });

    // Si tras unos segundos no hay sesión (link inválido/expirado), deja de mostrar el loader.
    const timeout = setTimeout(() => setChecking(false), 4000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("No se pudo establecer la contraseña. Intenta de nuevo.");
      return;
    }
    setDone(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600">
            <Database size={24} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">GD-DatosHub</h1>
            <p className="text-sm text-slate-500 mt-0.5">Crea tu contraseña</p>
          </div>
        </div>

        {checking ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !hasSession ? (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2.5 text-center">
            El link de invitación expiró o ya fue usado. Pide al administrador que te envíe una nueva invitación.
          </p>
        ) : done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm text-slate-600">¡Contraseña creada! Entrando a la plataforma…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Guardando…" : "Crear contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
