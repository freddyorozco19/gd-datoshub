import { RefreshCw } from "lucide-react";
import type { Company, Filters, Period } from "@/lib/dashboard/metrics";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "Mes" }, { id: "quarter", label: "Trimestre" }, { id: "year", label: "Año" },
];
const COMPANIES: { id: Company; label: string }[] = [
  { id: "COP", label: "COP · GROW DATA SAS" }, { id: "USD", label: "USD · INTERNATIONAL" },
];

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${on ? "border-violet-500 bg-violet-500/20 text-white" : "border-white/10 text-slate-300 hover:bg-white/[0.05]"}`;
const select = "px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0D0D1A] text-xs text-slate-300 max-w-[180px]";

interface Props {
  filters: Filters; onChange: (patch: Partial<Filters>) => void; onReset: () => void;
  lineas: string[]; comerciales: string[]; periodLabel: string;
  updatedAt: Date | null; loading: boolean; onReload: () => void;
}

export default function FilterBar({ filters, onChange, onReset, lineas, comerciales, periodLabel, updatedAt, loading, onReload }: Props) {
  const dirty = filters.linea !== "ALL" || filters.comercial !== "ALL" || filters.etapa !== "ALL";
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0D0D1A] px-4 py-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Periodo</span>
      {PERIODS.map((p) => (
        <button key={p.id} type="button" className={chip(filters.period === p.id)} onClick={() => onChange({ period: p.id })}>
          {p.label}{filters.period === p.id ? ` · ${periodLabel}` : ""}
        </button>
      ))}
      <span className="w-px h-5 bg-white/10 mx-1" />
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Compañía</span>
      {COMPANIES.map((c) => (
        <button key={c.id} type="button" className={chip(filters.company === c.id)} onClick={() => onChange({ company: c.id })}>{c.label}</button>
      ))}
      <span className="w-px h-5 bg-white/10 mx-1" />
      <select aria-label="Línea" className={select} value={filters.linea} onChange={(e) => onChange({ linea: e.target.value })}>
        <option value="ALL">Línea: todas</option>
        {lineas.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <select aria-label="Comercial" className={select} value={filters.comercial} onChange={(e) => onChange({ comercial: e.target.value })}>
        <option value="ALL">Comercial: todos</option>
        {comerciales.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {filters.etapa !== "ALL" && (
        <span className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300">Etapa: {filters.etapa}</span>
      )}
      {dirty && <button type="button" onClick={onReset} className="text-xs text-slate-400 hover:text-white underline">Limpiar filtros</button>}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
        {updatedAt && <span>ODOO · {updatedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
        <button type="button" onClick={onReload} disabled={loading} aria-label="Actualizar datos"
          className="p-1.5 rounded-lg border border-white/10 hover:bg-white/[0.06] disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
