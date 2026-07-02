"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Database, Loader2, Mail, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenciales incorrectas. Verifica tu email y contraseña.");
      setLoading(false);
      return;
    }

    try {
      await fetch("/api/auth/log-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch { /* ignora errores de logging */ }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4 relative z-10">
      {/* Card glassmorphism */}
      <div className="relative bg-white/[0.05] backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 p-8 overflow-hidden">
        {/* sheen superior */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 shadow-[0_0_24px_-4px_rgba(37,99,235,0.7)]">
            <Database size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">GD-DatosHub</h1>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="correo@growdata.co"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-slate-200 placeholder-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-slate-200 placeholder-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-400 leading-snug">{error}</p>
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-[0_0_20px_-4px_rgba(37,99,235,0.5)] mt-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Ingresando…" : "Login"}
          </button>
        </form>

      </div>
    </div>
  );
}
