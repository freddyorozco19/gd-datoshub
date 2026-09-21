"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Users, X, Search, AlertCircle, Loader2 } from "lucide-react";

export interface PresalesStatusRow {
  name: string;
  active: boolean;
  updated_by: string | null;
  updated_at: string | null;
}
export interface PresalesPerson { name: string; open: number; total: number }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function PresalesManageModal({
  people, statuses, onSave, onClose,
}: {
  people: PresalesPerson[];
  statuses: Record<string, PresalesStatusRow>;
  onSave: (changes: { name: string; active: boolean }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  // cambios pendientes (aún no guardados): nombre → activo
  const [draft, setDraft]   = useState<Record<string, boolean>>({});

  const effective = (name: string) => draft[name] ?? (statuses[name] ? statuses[name].active : true);
  // al confirmar se guardan los cambios y también los "Nuevos" (quedan revisados con su estado actual)
  const toSave = people
    .filter((p) => (statuses[p.name] ? effective(p.name) !== statuses[p.name].active : true))
    .map((p) => ({ name: p.name, active: effective(p.name) }));
  const pendingChanges = Object.keys(draft).filter((n) => statuses[n] && draft[n] !== statuses[n].active).length;

  // el orden se fija al abrir (nuevos → activos → inactivos) para que las filas no salten al cambiar un interruptor
  const [order] = useState(() =>
    [...people]
      .sort((a, b) => {
        const rank = (p: PresalesPerson) => (!statuses[p.name] ? 0 : statuses[p.name].active ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      })
      .map((p) => p.name),
  );
  const byName = useMemo(() => new Map(people.map((p) => [p.name, p])), [people]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(name: string, next: boolean) {
    setDraft((d) => ({ ...d, [name]: next }));
  }

  async function confirm() {
    if (toSave.length === 0) { onClose(); return; }
    setSaving(true); setError(null);
    try {
      await onSave(toSave);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
      setSaving(false);
    }
  }

  const q = norm(query.trim());
  const visible = order.filter((n) => !q || norm(n).includes(q));
  const last = Object.values(statuses)
    .filter((s) => s.updated_at)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];

  return createPortal(
    <div className="dashboard-shell">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget && pendingChanges === 0) onClose(); }}
      >
        <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
          <div className="app-bar modal-header flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/20 border border-blue-400/25">
                <Users size={16} className="text-blue-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-none">Gestionar preventas</h3>
                <p className="text-[10px] text-slate-400 mt-1">Marca quién sigue activo en la compañía</p>
              </div>
            </div>
            <button onClick={onClose} title="Cerrar"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/[0.1] text-slate-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar preventa…"
                className="w-full text-xs rounded-lg pl-8 pr-3 py-2 bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
              />
            </div>
            {error && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto px-3 pb-3">
            {visible.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Sin resultados</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {visible.map((name) => {
                  const p = byName.get(name);
                  const isNew = !statuses[name];
                  const active = effective(name);
                  return (
                    <div key={name} className="flex items-center gap-3 px-2 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold truncate ${active ? "text-slate-100" : "text-slate-500"}`} title={name}>{name}</p>
                          {isNew && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 uppercase tracking-wide">Nuevo</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {p?.open ?? 0} abiertos · {p?.total ?? 0} totales
                          {!active && (p?.open ?? 0) > 0 && (
                            <span className="text-amber-400 font-medium"> · {p?.open} por reasignar</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 w-14 text-right">{active ? "Activo" : "Inactivo"}</span>
                      <button
                        type="button" role="switch" aria-checked={active} disabled={saving}
                        onClick={() => toggle(name, !active)}
                        title={active ? "Marcar como inactivo" : "Marcar como activo"}
                        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${active ? "bg-blue-500" : "bg-white/[0.12]"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t border-white/[0.07] shrink-0 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-[10px] text-slate-500">
              {pendingChanges > 0
                ? <span className="text-amber-400 font-medium">{pendingChanges} cambio{pendingChanges === 1 ? "" : "s"} sin confirmar</span>
                : last?.updated_at
                  ? <>Último cambio: {last.updated_by ?? "—"} · {fmtStamp(last.updated_at)}</>
                  : "Sin cambios registrados todavía"}
            </p>
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={confirm} disabled={saving}
              className="app-bar flex items-center gap-2 px-5 py-2 rounded-xl text-xs text-white font-medium disabled:opacity-60 transition-all"
              style={{
                background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
                boxShadow: "0 2px 12px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                border: "1px solid rgba(99,102,241,0.4)",
              }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
