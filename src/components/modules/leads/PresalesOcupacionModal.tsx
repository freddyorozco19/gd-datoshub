"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Settings } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";

/* Detalle de la card Ocupación (Presales): desglosa los leads abiertos por preventa, línea y compañía.
   Misma base que la columna Ocupación de "Carga por preventa": ocupación = abiertos ÷ límite (Configuración). */

const ocupColor = (p: number) => (p >= 100 ? "bg-rose-500" : p >= 70 ? "bg-amber-500" : "bg-blue-500");
const ocupText  = (p: number) => (p >= 100 ? "text-rose-500" : p >= 70 ? "text-amber-500" : "text-slate-300");
const isInt = (l: Lead) => (l.compania || "").toLowerCase().includes("international");

type Row = { name: string; open: number; kind: "profesional" | "lider" | "gerente" };
const KIND_TXT = { profesional: "Profesional", lider: "Líder", gerente: "Gerente" } as const;

export default function PresalesOcupacionModal({
  rows, leads, limit, blocked, onClose, onList, onOpenSettings,
}: {
  rows: Row[];                       // preventas listados con su cantidad de leads abiertos
  leads: Lead[];                     // leads abiertos de esos preventas
  limit: number;                     // máximo de leads abiertos por preventa (100 %)
  blocked: boolean;                  // hay otro popup encima: no cerrar con Esc
  onClose: () => void;
  onList: (leads: Lead[], heading: string) => void;
  onOpenSettings: () => void;         // abre la configuración (sección Ocupación máxima)
}) {
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, onClose]);

  const d = useMemo(() => {
    // la ocupación global solo cuenta a los profesionales
    const prof = rows.filter((r) => r.kind === "profesional");
    const capacity = limit * prof.length;
    const totalOpen = prof.reduce((s, r) => s + r.open, 0);
    const global = capacity ? Math.round((totalOpen / capacity) * 100) : 0;
    const pctOf = (n: number) => Math.round((n / limit) * 100);
    const alerta = prof.filter((r) => pctOf(r.open) >= 70).length;
    const limite = prof.filter((r) => pctOf(r.open) >= 100).length;

    const byLinea = new Map<string, Lead[]>();
    for (const l of leads) { const k = l.linea || "Sin línea"; byLinea.set(k, [...(byLinea.get(k) ?? []), l]); }
    const lineas = [...byLinea.entries()].sort((a, b) => b[1].length - a[1].length);

    const comps = [
      { key: "SAS", label: "GROW DATA",        leads: leads.filter((l) => !isInt(l)) },
      { key: "INT", label: "GD INTERNATIONAL", leads: leads.filter(isInt) },
    ];
    const prevCount = (arr: Lead[]) => new Set(arr.map((l) => l.preventa || "Sin asignar")).size;
    return { capacity, totalOpen, global, pctOf, alerta, limite, lineas, comps, prevCount };
  }, [rows, leads, limit]);

  const share = (n: number) => (d.totalOpen ? Math.round((n / d.totalOpen) * 100) : 0);
  const leadsOf = (name: string) => leads.filter((l) => (l.preventa || "Sin asignar") === name);

  const stat = (label: string, value: string, cls = "text-slate-100") => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</p>
    </div>
  );

  const secTitle = (t: string, hint?: string) => (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200">{t}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );

  return createPortal(
    <div className="dashboard-shell">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
          <div className="app-bar modal-header flex items-center justify-between px-6 h-[60px] shrink-0 border-b border-white/[0.07]">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-100 uppercase tracking-wide text-sm">Ocupación de preventas</h2>
              <p className="text-[11px] text-slate-400 truncate">Leads abiertos frente al máximo de {limit} por preventa · la ocupación global solo cuenta a los profesionales</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onOpenSettings} title="Configurar la ocupación máxima" aria-label="Configuración" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors">
                <Settings size={17} />
              </button>
              <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stat("Ocupación global", `${d.global}%`, ocupText(d.global))}
              {stat("Leads abiertos", `${d.totalOpen} de ${d.capacity}`)}
              {stat("En alerta (≥ 70 %)", String(d.alerta), d.alerta ? "text-amber-500" : "text-slate-100")}
              {stat("Al límite (≥ 100 %)", String(d.limite), d.limite ? "text-rose-500" : "text-slate-100")}
            </div>

            <section>
              {secTitle("Por preventa", "Clic en una fila para ver sus leads abiertos")}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-white/[0.08]">
                      <th className="text-left font-semibold px-4 py-2.5">Preventa</th>
                      <th className="text-right font-semibold px-3 py-2.5">Abiertos</th>
                      <th className="text-right font-semibold px-3 py-2.5">Disponibles</th>
                      <th className="text-left font-semibold px-3 py-2.5 w-52">Ocupación</th>
                      {d.lineas.map(([ln]) => (
                        <th key={ln} className="text-right font-semibold px-3 py-2.5 whitespace-nowrap max-w-[140px] truncate" title={ln}>{ln}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {[...rows].sort((a, b) => b.open - a.open).map((r) => {
                      const p = d.pctOf(r.open);
                      const mine = leadsOf(r.name);
                      return (
                        <tr key={r.name} onClick={() => onList(mine, r.name)} className="row-hover cursor-pointer">
                          <td className="px-4 py-2.5 font-medium text-slate-200 whitespace-nowrap">{r.name}{r.kind !== "profesional" && <span className="kind-badge ml-2 align-middle text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">{KIND_TXT[r.kind]}</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{r.open}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{Math.max(0, limit - r.open)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                <div className={`h-full rounded-full ${ocupColor(p)}`} style={{ width: `${Math.min(100, p)}%` }} />
                              </div>
                              <span className={`w-10 text-right tabular-nums ${ocupText(p)}`}>{p}%</span>
                            </div>
                          </td>
                          {d.lineas.map(([ln]) => {
                            const n = mine.filter((l) => (l.linea || "Sin línea") === ln).length;
                            return <td key={ln} className={`px-3 py-2.5 text-right tabular-nums ${n ? "text-slate-300" : "text-slate-600"}`}>{n || "—"}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                {secTitle("Por línea", "Participación en los leads abiertos")}
                <div className="space-y-1.5">
                  {d.lineas.map(([ln, arr]) => (
                    <button key={ln} type="button" onClick={() => onList(arr, ln)}
                      className="row-hover w-full text-left flex items-center gap-3 text-xs rounded-lg px-2 py-1.5 cursor-pointer">
                      <span className="w-40 shrink-0 truncate font-medium text-slate-200" title={ln}>{ln}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${share(arr.length)}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums text-slate-300">{arr.length} · {share(arr.length)}%</span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-slate-500">{d.prevCount(arr)} prev.</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                {secTitle("Por compañía", "Participación en los leads abiertos")}
                <div className="space-y-1.5">
                  {d.comps.map((c) => (
                    <button key={c.key} type="button" disabled={c.leads.length === 0} onClick={() => onList(c.leads, c.label)}
                      className="row-hover w-full text-left flex items-center gap-3 text-xs rounded-lg px-2 py-1.5 cursor-pointer disabled:cursor-default">
                      <span className="w-40 shrink-0 truncate font-medium text-slate-200">{c.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className={`h-full rounded-full ${c.key === "SAS" ? "bg-blue-400" : "bg-teal-400"}`} style={{ width: `${share(c.leads.length)}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums text-slate-300">{c.leads.length} · {share(c.leads.length)}%</span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-slate-500">{d.prevCount(c.leads)} prev.</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
