import type { MixRow, PresalesRow, SellerRow } from "@/lib/dashboard/metrics";
import { Card, EmptyState, fmtMoney } from "./ui";

const PALETTE = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#64748B", "#EC4899"];

export function MixByLine({ rows, company }: { rows: MixRow[]; company: "COP" | "USD" }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const R = 44, C = 2 * Math.PI * R;
  const starts = rows.reduce<number[]>((acc, r, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (rows[i - 1].value / (total || 1)) * C], []);
  return (
    <Card title="Mix por línea" subtitle="Valor del pipeline abierto">
      {total === 0 ? <EmptyState>Sin valor por línea</EmptyState> : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" className="w-[120px] h-[120px] shrink-0" role="img"
            aria-label={`Distribución: ${rows.map((r) => `${r.label} ${Math.round((r.value / total) * 100)}%`).join(", ")}`}>
            {rows.map((r, i) => {
              const len = (r.value / total) * C;
              return <circle key={r.label} cx="60" cy="60" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-starts[i]} transform="rotate(-90 60 60)" />;
            })}
          </svg>
          <ul className="flex-1 min-w-0 space-y-2 text-xs">
            {rows.map((r, i) => (
              <li key={r.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 truncate"><i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />{r.label}</span>
                <span className="tabular-nums text-slate-300">{Math.round((r.value / total) * 100)}% · {fmtMoney(r.value, company)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function PresalesLoad({ rows }: { rows: PresalesRow[] }) {
  const states = [...new Set(rows.flatMap((r) => Object.keys(r.states)))];
  return (
    <Card title="Preventa" subtitle="Oportunidades abiertas por preventa y estado">
      {rows.length === 0 ? <EmptyState>Sin oportunidades con preventa asignada</EmptyState> : (
        <>
          <ul className="space-y-3">
            {rows.slice(0, 6).map((r) => (
              <li key={r.name}>
                <div className="flex justify-between text-xs mb-1"><span className="truncate">{r.name}</span><span className="tabular-nums text-slate-400">{r.total} activas</span></div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                  {Object.entries(r.states).map(([st, n]) => (
                    <i key={st} title={`${st}: ${n}`} style={{ width: `${(n / r.total) * 100}%`, background: PALETTE[states.indexOf(st) % PALETTE.length] }} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-slate-400">
            {states.map((s, i) => <span key={s}><i className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: PALETTE[i % PALETTE.length] }} />{s}</span>)}
          </p>
        </>
      )}
    </Card>
  );
}

export function SalesRanking({ rows, company, periodLabel, onSelect }: {
  rows: SellerRow[]; company: "COP" | "USD"; periodLabel: string; onSelect: (name: string) => void;
}) {
  return (
    <Card title="Ranking de comerciales" subtitle={`Ganado en ${periodLabel} · clic para filtrar`}>
      {rows.length === 0 ? <EmptyState>Sin datos de comerciales</EmptyState> : (
        <ul>
          {rows.slice(0, 6).map((s, i) => (
            <li key={s.name} className="border-b border-white/[0.05] last:border-0">
              <button type="button" onClick={() => onSelect(s.name)} className="w-full flex items-center gap-3 py-2 text-xs text-left hover:bg-white/[0.03] rounded">
                <span className="w-4 text-slate-500 tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="tabular-nums text-slate-200">{fmtMoney(s.won, company)}</span>
                <span className="w-24 text-right text-slate-400 tabular-nums">{s.winRate === null ? "—" : `${s.winRate}% cierre`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
