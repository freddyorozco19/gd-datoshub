"use client";

import { useEffect } from "react";
import { TrendingUp, X } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { Company } from "@/lib/dashboard/metrics";
import { closeDateOf } from "@/lib/dashboard/metrics";
import { EmptyState, fmtMoney } from "./ui";

interface Props {
  leads: Lead[]; company: Company; periodLabel: string;
  onOpenLead: (lead: Lead) => void; onClose: () => void;
  /** true mientras el detalle de un lead está encima: Esc debe cerrar solo el detalle */
  escDisabled: boolean;
}

const fmtDay = (l: Lead) => {
  const d = closeDateOf(l);
  return d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

export default function WonLeadsModal({ leads, company, periodLabel, onOpenLead, onClose, escDisabled }: Props) {
  useEffect(() => {
    if (escDisabled) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, escDisabled]);

  const total = leads.reduce((a, l) => a + (l.ingresosEsperados || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Leads ganados ${periodLabel}`}
        className="relative w-full max-w-6xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.10] shadow-2xl overflow-hidden"
        style={{ background: "rgba(10,10,20,0.98)" }}>

        <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.06] shrink-0"
          style={{ background: "radial-gradient(ellipse 80% 120% at 0% 0%, #10B98118 0%, transparent 65%)" }}>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.08] transition-colors">
            <X size={16} />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Ganado · {periodLabel}</p>
              <p className="text-2xl font-bold text-white leading-none mt-1 tabular-nums">{fmtMoney(total, company)}</p>
            </div>
            <div className="ml-auto text-right pr-6">
              <p className="text-2xl font-bold text-white leading-none tabular-nums">{leads.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">leads ganados</p>
            </div>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {leads.length === 0 ? <EmptyState>Sin ventas registradas en este periodo</EmptyState> : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0A0A14] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Fecha de venta</th>
                  <th className="text-left font-semibold px-4 py-2.5">Oportunidad</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Cliente</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Comercial</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden lg:table-cell">Línea</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Etapa actual</th>
                  <th className="text-left font-semibold px-4 py-2.5">Activo</th>
                  <th className="text-left font-semibold px-4 py-2.5">Ganado</th>
                  <th className="text-right font-semibold px-4 py-2.5">Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} tabIndex={0} onClick={() => onOpenLead(l)}
                    onKeyDown={(e) => { if (e.key === "Enter") onOpenLead(l); }}
                    className="border-t border-white/[0.05] hover:bg-white/[0.04] cursor-pointer focus:outline-none focus:bg-white/[0.06]">
                    <td className="px-4 py-2.5 text-emerald-300 tabular-nums whitespace-nowrap">{fmtDay(l)}</td>
                    <td className="px-4 py-2.5 text-slate-200 max-w-[260px] truncate">{l.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-400 hidden md:table-cell max-w-[180px] truncate">{l.cliente || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 hidden md:table-cell whitespace-nowrap">{l.comercial || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 hidden lg:table-cell">{l.linea || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{l.etapa || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${l.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-400"}`}>{l.activo ? "Sí" : "No"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${l.ganado === "Ganado" ? "bg-emerald-500/10 text-emerald-400" : l.ganado === "Perdido" ? "bg-rose-500/10 text-rose-400" : "bg-white/[0.06] text-slate-400"}`}>{l.ganado}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{l.ingresosEsperados ? fmtMoney(l.ingresosEsperados, company) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="px-6 py-3 border-t border-white/[0.06] text-[11px] text-slate-500 shrink-0">Clic en una fila para ver el detalle del lead.</p>
      </div>
    </div>
  );
}
