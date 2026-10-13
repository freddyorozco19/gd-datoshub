import type { Lead } from "@/lib/odoo/types";
import type { AttentionItem, AttentionKind } from "@/lib/dashboard/metrics";
import { probOf } from "@/lib/dashboard/metrics";
import { Card, EmptyState, fmtMoney, fmtShortDate } from "./ui";

const KIND_STYLE: Record<AttentionKind, string> = {
  "Vencido": "bg-rose-500/15 text-rose-300",
  "Estancado": "bg-amber-500/15 text-amber-300",
  "Sin preventa": "bg-amber-500/15 text-amber-300",
  "Sin monto": "bg-cyan-500/15 text-cyan-300",
};

export function AttentionList({ items, company, onOpen }: { items: AttentionItem[]; company: "COP" | "USD"; onOpen: (l: Lead) => void }) {
  return (
    <Card tone={items.length ? "warn" : undefined} title="Atención requerida" subtitle="Reglas automáticas · clic abre el detalle del lead">
      {items.length === 0 ? <EmptyState>Nada pendiente. Todo al día.</EmptyState> : (
        <ul className="max-h-[300px] overflow-auto">
          {items.slice(0, 12).map((it, i) => (
            <li key={`${it.lead.id}-${it.kind}-${i}`} className="border-b border-white/[0.05] last:border-0">
              <button type="button" onClick={() => onOpen(it.lead)} className="w-full flex items-center gap-3 py-2 text-xs text-left hover:bg-white/[0.03] rounded">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${KIND_STYLE[it.kind]}`}>{it.kind}</span>
                <span className="flex-1 truncate">{it.lead.nombre}{it.lead.cliente ? ` · ${it.lead.cliente}` : ""}</span>
                <span className="text-slate-400 hidden sm:inline shrink-0">{it.detail}</span>
                <span className="tabular-nums shrink-0">{it.lead.ingresosEsperados ? fmtMoney(it.lead.ingresosEsperados, company) : "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 12 && <p className="text-[11px] text-slate-500 mt-2">Mostrando 12 de {items.length}</p>}
    </Card>
  );
}

export function UpcomingCloses({ leads, company, onOpen }: { leads: Lead[]; company: "COP" | "USD"; onOpen: (l: Lead) => void }) {
  return (
    <Card title="Cierres próximos 30 días" subtitle="Por fecha de cierre esperado, con probabilidad por etapa">
      {leads.length === 0 ? <EmptyState>Sin cierres esperados en los próximos 30 días</EmptyState> : (
        <ul className="max-h-[300px] overflow-auto">
          {leads.slice(0, 10).map((l) => (
            <li key={l.id} className="border-b border-white/[0.05] last:border-0">
              <button type="button" onClick={() => onOpen(l)} className="w-full flex items-center gap-3 py-2 text-xs text-left hover:bg-white/[0.03] rounded">
                <span className="w-14 text-cyan-300 tabular-nums shrink-0">{fmtShortDate(l.cierreEsperado)}</span>
                <span className="flex-1 truncate">{l.nombre}{l.cliente ? ` · ${l.cliente}` : ""}</span>
                <span className="text-slate-400 hidden sm:inline shrink-0">{l.etapa || "—"} · {Math.round(probOf(l) * 100)}%</span>
                <span className="tabular-nums shrink-0">{l.ingresosEsperados ? fmtMoney(l.ingresosEsperados, company) : "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
