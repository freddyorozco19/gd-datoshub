"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, UserCheck, GraduationCap, CornerDownLeft, Loader2 } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";

/* Búsqueda global ⌘K / Ctrl+K: páginas, leads, preventas y exámenes. Los leads (Odoo) y el catálogo de
   exámenes se cargan la primera vez que se abre y se reutilizan mientras la pestaña siga viva. */

type Group = "Páginas" | "Leads" | "Preventas" | "Exámenes";
interface Item { key: string; group: Group; title: string; sub?: string; href: string; hay: string }

const PAGES: { label: string; href: string; extra?: string }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leads · Business", href: "/leads", extra: "oportunidades comercial" },
  { label: "Leads · Presales", href: "/leads/presales", extra: "preventas preventa" },
  { label: "Productos", href: "/productos" },
  { label: "CMMI", href: "/cmmi" },
  { label: "Certificaciones", href: "/certificaciones", extra: "exámenes" },
  { label: "Usuarios", href: "/usuarios", extra: "administración roles" },
  { label: "Dataset", href: "/dataset", extra: "odoo gobierno de datos" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let leadsCache: Lead[] | null = null;
let examsCache: Item[] | null = null;

const ICON = { "Páginas": FileText, Leads: Users, Preventas: UserCheck, "Exámenes": GraduationCap } as const;

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [leads, setLeads] = useState<Lead[] | null>(leadsCache);
  const [exams, setExams] = useState<Item[] | null>(examsCache);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (!leadsCache) {
      fetch("/api/odoo/leads").then((r) => r.json()).then((d) => {
        if (Array.isArray(d.leads)) { leadsCache = d.leads; setLeads(d.leads); } else setFailed(true);
      }).catch(() => setFailed(true));
    }
    if (!examsCache) {
      import("@/components/modules/certificaciones/CertificacionesView").then(({ PROVIDERS }) => {
        examsCache = PROVIDERS.flatMap((p) => p.exams.map((e): Item => ({
          key: `x-${p.id}-${e.id}`, group: "Exámenes", title: `${e.code} · ${e.name}`, sub: p.alias ? `${p.name} (${p.alias})` : p.name,
          href: `/certificaciones/${p.id}/${e.id}`, hay: norm(`${e.code} ${e.name} ${p.name} ${p.alias ?? ""}`),
        })));
        setExams(examsCache);
      }).catch(() => {});
    }
  }, [open]);

  const all = useMemo<Item[]>(() => {
    const pages = PAGES.map((p): Item => ({ key: `p-${p.href}`, group: "Páginas", title: p.label, href: p.href, hay: norm(`${p.label} ${p.extra ?? ""}`) }));
    const ls = (leads ?? []).map((l): Item => ({
      key: `l-${l.id}`, group: "Leads", title: `#${l.id} · ${l.nombre}`,
      sub: [l.cliente, l.etapa, l.preventa && `Preventa: ${l.preventa}`].filter(Boolean).join(" · "),
      href: `/leads?lead=${l.id}`, hay: norm(`${l.id} ${l.nombre} ${l.cliente} ${l.comercial} ${l.preventa}`),
    }));
    const names = [...new Set((leads ?? []).map((l) => l.preventa).filter(Boolean))].sort();
    const ps = names.map((n): Item => ({ key: `v-${n}`, group: "Preventas", title: n, sub: "Ficha de preventa", href: `/leads/presales?preventa=${encodeURIComponent(n)}`, hay: norm(n) }));
    return [...pages, ...ps, ...ls, ...(exams ?? [])];
  }, [leads, exams]);

  const results = useMemo(() => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return all.filter((i) => i.group === "Páginas");
    const hit = all.filter((i) => toks.every((t) => i.hay.includes(t)));
    const first = toks[0];
    const score = (i: Item) => (norm(i.title).replace(/^#/, "").startsWith(first) ? 0 : 1);
    const order: Group[] = ["Páginas", "Preventas", "Leads", "Exámenes"];
    return order.flatMap((g) => hit.filter((i) => i.group === g).sort((a, b) => score(a) - score(b)).slice(0, 6));
  }, [all, q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;
  const loading = !failed && (!leads || !exams);
  const go = (i: Item) => { onClose(); router.push(i.href); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((v) => Math.min(results.length - 1, v + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((v) => Math.max(0, v - 1)); }
    else if (e.key === "Enter" && results[idx]) { e.preventDefault(); go(results[idx]); }
  };

  return createPortal(
    <div className="dashboard-shell">
      <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
        <div role="dialog" aria-label="Búsqueda global" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}
          className="w-full max-w-xl rounded-2xl border border-white/[0.12] shadow-2xl overflow-hidden" style={{ background: "var(--app-topbar-bg)" }}>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.08]">
            <Search size={15} className="text-slate-500 shrink-0" />
            <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              placeholder="Buscar páginas, leads, preventas o exámenes…" aria-label="Buscar"
              className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500" />
            {loading && <Loader2 size={14} className="animate-spin text-slate-500 shrink-0" />}
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-500 font-mono">Esc</kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-500">{loading ? "Cargando datos…" : "Sin resultados"}</p>
            )}
            {results.map((it, i) => {
              const Icon = ICON[it.group];
              return (
                <div key={it.key}>
                  {(i === 0 || results[i - 1].group !== it.group) && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{it.group}</p>
                  )}
                  <button type="button" data-i={i} onClick={() => go(it)} onMouseMove={() => setIdx(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${i === idx ? "bg-blue-500/15" : ""}`}>
                    <Icon size={14} className="text-slate-500 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-200">{it.title}</span>
                      {it.sub && <span className="block truncate text-[11px] text-slate-500">{it.sub}</span>}
                    </span>
                    {i === idx && <CornerDownLeft size={12} className="text-slate-500 shrink-0" />}
                  </button>
                </div>
              );
            })}
            {failed && <p className="px-3 py-2 text-[11px] text-amber-500">No se pudieron cargar los leads de Odoo; solo se buscan páginas y exámenes.</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
