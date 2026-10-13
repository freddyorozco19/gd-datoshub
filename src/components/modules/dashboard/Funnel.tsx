import type { FunnelRow } from "@/lib/dashboard/metrics";
import { Card, EmptyState, fmtMoney } from "./ui";

const COLORS = ["#7C3AED", "#6D5BE0", "#4F83E8", "#06B6D4", "#10B981"];

export default function Funnel({ rows, company, selected, onSelect }: {
  rows: FunnelRow[]; company: "COP" | "USD"; selected: string; onSelect: (etapa: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card title="Embudo por etapa" subtitle="Oportunidades abiertas y valor · clic en una etapa para filtrar el dashboard">
      {rows.length === 0 ? <EmptyState>Sin oportunidades abiertas con estos filtros</EmptyState> : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const active = selected === r.etapa;
            return (
              <button key={r.etapa} type="button" onClick={() => onSelect(active ? "ALL" : r.etapa)}
                className={`w-full grid grid-cols-[minmax(90px,150px)_1fr_auto] items-center gap-3 text-left rounded-lg px-2 py-1.5 transition-colors ${active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}>
                <span className="text-xs text-slate-300 truncate">{r.etapa}</span>
                <span className="h-5 rounded-md bg-white/[0.05] overflow-hidden">
                  <span className="block h-full rounded-md" style={{ width: `${(r.count / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                </span>
                <span className="text-xs tabular-nums text-slate-200 text-right">{r.count} · {fmtMoney(r.value, company)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
