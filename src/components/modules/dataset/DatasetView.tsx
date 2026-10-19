"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database, BookText, Search, Columns3, Download, RefreshCw, X, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Copy, Check, Key, Loader2, AlertCircle,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { OdooFieldMeta } from "@/lib/odoo/types";
import { uniqueEtapaActual } from "@/components/modules/leads/etapaOrder";

/* Dataset — explorador de la API de Odoo (solo administradores).
   La llave primaria es el ID; las columnas se eligen entre todos los campos del modelo (fields_get). */

const MODEL = "crm.lead";
const PAGE_SIZE = 50;
const ETAPA_FIELD = "x_studio_etapa_actual";
const EMPTY_VALUE = "__empty__";
const COLS_KEY = "dataset-columns-v1";
const DEFAULT_COLS = [
  "id", "name", "partner_id", "company_id", "x_studio_etapa_actual", "x_studio_edopreventa",
  "x_studio_preventa", "expected_revenue", "create_date",
];

type Row = Record<string, unknown>;
type Sort = { field: string; dir: "asc" | "desc" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* texto de una celda según el tipo de campo */
function cellText(v: unknown, f?: OdooFieldMeta): string {
  if (v === false || v === null || v === undefined) return f?.type === "boolean" ? "No" : "—";
  if (v === true) return "Sí";
  if (Array.isArray(v)) {
    if (f?.type === "many2one" && v.length === 2 && typeof v[0] === "number") return `${v[1]} (${v[0]})`;
    return v.length ? JSON.stringify(v) : "—";
  }
  if (typeof v === "number") {
    return f?.type === "float" || f?.type === "monetary" ? v.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : String(v);
  }
  if (typeof v === "string") return f?.type === "html" ? v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "—" : v || "—";
  return JSON.stringify(v);
}

const csvEscape = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export default function DatasetView() {
  const pathname = usePathname();
  const tab: "datos" | "catalogo" = pathname.endsWith("/catalogo") ? "catalogo" : "datos";

  /* ── catálogo de campos ── */
  const [metaRes, setMetaRes] = useState<{ fields?: OdooFieldMeta[]; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/odoo/dataset/fields?model=${MODEL}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
        if (!cancelled) setMetaRes({ fields: j.fields as OdooFieldMeta[] });
      })
      .catch((e) => { if (!cancelled) setMetaRes({ error: e instanceof Error ? e.message : "No se pudo leer el catálogo." }); });
    return () => { cancelled = true; };
  }, []);
  const meta = useMemo(() => metaRes?.fields ?? [], [metaRes]);
  const metaByName = useMemo(() => new Map(meta.map((f) => [f.name, f])), [meta]);

  /* ── columnas elegidas (se recuerdan en este navegador) ── */
  const [cols, setCols] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(COLS_KEY) : null;
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string") && arr.length) return arr;
    } catch { /* sin almacenamiento */ }
    return DEFAULT_COLS;
  });
  const setColsSaved = (next: string[]) => {
    const withId = next.includes("id") ? next : ["id", ...next];
    setCols(withId);
    try { window.localStorage.setItem(COLS_KEY, JSON.stringify(withId)); } catch { /* ignorar */ }
  };
  const toggleCol = (name: string) => setColsSaved(cols.includes(name) ? cols.filter((c) => c !== name) : [...cols, name]);
  const visibleCols = useMemo(() => {
    const known = cols.filter((c) => !metaRes?.fields || metaByName.has(c));
    return known.includes("id") ? ["id", ...known.filter((c) => c !== "id")] : ["id", ...known];
  }, [cols, metaRes, metaByName]);

  /* ── datos ── */
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<Sort>({ field: "id", dir: "desc" });
  const [reload, setReload] = useState(0);
  const [etapa, setEtapa] = useState("ALL");   // filtro por Etapa Actual (x_studio_etapa_actual)
  const [etapaOpts, setEtapaOpts] = useState<{ value: string; count: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/odoo/dataset?model=${MODEL}&facet=${ETAPA_FIELD}`)
      .then(async (r) => { const j = await r.json(); if (r.ok && !cancelled) setEtapaOpts(j.values as { value: string; count: number }[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const etapaList = useMemo(() => {
    const byValue = new Map(etapaOpts.map((o) => [o.value, o.count]));
    const names = uniqueEtapaActual(etapaOpts.map((o) => o.value).filter((v) => v !== EMPTY_VALUE)).filter((v) => v !== "ALL");
    return [...names, ...(byValue.has(EMPTY_VALUE) ? [EMPTY_VALUE] : [])].map((v) => ({ value: v, count: byValue.get(v) ?? 0 }));
  }, [etapaOpts]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const key = `${visibleCols.join(",")}|${q}|${etapa}|${page}|${sort.field}:${sort.dir}|${reload}`;
  const [dataRes, setDataRes] = useState<{ key: string; rows?: Row[]; total?: number; error?: string } | null>(null);
  useEffect(() => {
    if (tab !== "datos" || !metaRes?.fields) return;
    let cancelled = false;
    const params = new URLSearchParams({
      model: MODEL, fields: visibleCols.join(","), offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE),
      q, sort: `${sort.field}:${sort.dir}`,
    });
    if (etapa !== "ALL") { params.set("ff", ETAPA_FIELD); params.set("fv", etapa); }
    fetch(`/api/odoo/dataset?${params}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
        if (!cancelled) setDataRes({ key, rows: j.records as Row[], total: j.total as number });
      })
      .catch((e) => { if (!cancelled) setDataRes({ key, error: e instanceof Error ? e.message : "No se pudo leer el dataset." }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tab, metaRes]);
  const loading = tab === "datos" && !!metaRes?.fields && (!dataRes || dataRes.key !== key);
  const rows = dataRes && dataRes.key === key ? dataRes.rows ?? [] : (dataRes?.rows ?? []);
  const total = dataRes?.total ?? 0;
  const dataError = dataRes && dataRes.key === key ? dataRes.error : undefined;
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const toggleSort = (f: OdooFieldMeta | undefined, name: string) => {
    if (!f?.stored) return;
    setSort((s) => (s.field === name ? { field: name, dir: s.dir === "asc" ? "desc" : "asc" } : { field: name, dir: "asc" }));
    setPage(0);
  };

  /* ── selector de columnas, detalle y exportación ── */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const exportCsv = () => {
    const head = visibleCols.map((c) => csvEscape(metaByName.get(c)?.label ?? c)).join(";");
    const body = rows.map((r) => visibleCols.map((c) => csvEscape(cellText(r[c], metaByName.get(c)))).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dataset-${MODEL}-pagina-${page + 1}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── pestañas (enlaces reales) ── */
  const tabItems = [
    { id: "datos", href: "/dataset/datos", label: "Datos", icon: Database },
    { id: "catalogo", href: "/dataset/catalogo", label: "Catálogo de campos", icon: BookText },
  ] as const;
  const topbarTabs = (
    <>
      {tabItems.map(({ id, href, label, icon: Icon }) => {
        const active = id === tab;
        return (
          <Link key={id} href={href}
            className={`relative flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors hover:bg-white/[0.04] ${active ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
            <Icon size={13} />
            {label}
            <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full transition-all"
              style={{ background: active ? "rgba(96,165,250,1)" : "transparent", boxShadow: active ? "0 0 8px rgba(96,165,250,0.6)" : "none" }} />
          </Link>
        );
      })}
    </>
  );

  /* ── catálogo: filtros ── */
  const [catQ, setCatQ] = useState("");
  const [catType, setCatType] = useState("ALL");
  const [catCustom, setCatCustom] = useState(false);
  const types = useMemo(() => ["ALL", ...Array.from(new Set(meta.map((f) => f.type))).sort()], [meta]);
  const catRows = useMemo(() => {
    const nq = norm(catQ.trim());
    return meta.filter((f) => (catType === "ALL" || f.type === catType) && (!catCustom || f.custom)
      && (!nq || norm(f.name).includes(nq) || norm(f.label).includes(nq)));
  }, [meta, catQ, catType, catCustom]);

  const pickerRows = useMemo(() => {
    const nq = norm(pickerQ.trim());
    return meta.filter((f) => !f.heavy && (!nq || norm(f.name).includes(nq) || norm(f.label).includes(nq))).slice(0, 200);
  }, [meta, pickerQ]);

  const inputCls = "rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60";

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Dataset" subtitle="Explorador de la API de Odoo · solo administradores" tabs={topbarTabs} />
      <main className="flex-1 p-6 space-y-4">
        {metaRes?.error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {metaRes.error}
          </div>
        )}

        {tab === "datos" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill-option inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border" data-active="true">
                <Database size={13} /> {MODEL}
              </span>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar por ID, nombre o correo…" className={`${inputCls} pl-8 w-64`} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Etapa actual
                <select value={etapa} onChange={(e) => { setEtapa(e.target.value); setPage(0); }} aria-label="Filtrar por Etapa actual"
                  className={`cmmi-select ${inputCls} max-w-[240px]`}>
                  <option value="ALL">Todas</option>
                  {etapaList.map((o) => (
                    <option key={o.value} value={o.value}>{o.value === EMPTY_VALUE ? "Sin etapa" : o.value} ({o.count.toLocaleString("es-CO")})</option>
                  ))}
                </select>
              </label>
              <div className="relative">
                <button type="button" onClick={() => setPickerOpen((v) => !v)} className="pill-option inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border" data-active={pickerOpen}>
                  <Columns3 size={13} /> Columnas · {visibleCols.length} de {meta.length || "…"}
                </button>
                {pickerOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
                    <div className="modal-panel backdrop-blur-2xl absolute left-0 top-full mt-2 z-40 w-80 rounded-xl border border-white/[0.14] shadow-2xl shadow-black/50 p-3">
                      <input value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Buscar campo…" autoFocus className={`${inputCls} w-full mb-2`} />
                      <div className="max-h-72 overflow-auto divide-y divide-white/[0.05]">
                        {pickerRows.map((f) => (
                          <label key={f.name} className="row-hover flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer">
                            <input type="checkbox" checked={visibleCols.includes(f.name)} disabled={f.name === "id"} onChange={() => toggleCol(f.name)} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs text-slate-200 truncate">{f.label}</span>
                              <span className="block text-[10px] text-slate-500 font-mono truncate">{f.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">{f.type}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-between pt-2 mt-1 border-t border-white/[0.08]">
                        <button type="button" onClick={() => setColsSaved(DEFAULT_COLS)} className="pill-option text-[11px] font-medium px-2.5 py-1 rounded-lg border">Restablecer</button>
                        <button type="button" onClick={() => setPickerOpen(false)} className="pill-option text-[11px] font-medium px-2.5 py-1 rounded-lg border">Listo</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <span className="flex-1" />
              <button type="button" onClick={exportCsv} disabled={!rows.length} className="pill-option inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border disabled:opacity-50 disabled:cursor-default">
                <Download size={13} /> Exportar CSV
              </button>
              <button type="button" onClick={() => setReload((n) => n + 1)} title="Actualizar" aria-label="Actualizar" className="pill-option flex items-center justify-center p-2.5 rounded-lg border">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {dataError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {dataError}
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-290px)]">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr>
                      {visibleCols.map((c) => {
                        const f = metaByName.get(c);
                        const isId = c === "id";
                        const active = sort.field === c;
                        return (
                          <th key={c} onClick={() => toggleSort(f, c)}
                            className={`dataset-head ${isId ? "dataset-id" : ""} th-sort text-left font-semibold px-3 py-2.5 whitespace-nowrap ${f?.stored ? "cursor-pointer" : ""}`}>
                            <span className="flex items-center gap-1 uppercase tracking-wide text-[10px]">
                              {isId && <Key size={11} />}
                              {f?.label ?? c}
                              {active && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                            </span>
                            <span className="block text-[10px] font-mono normal-case tracking-normal font-normal opacity-70">{c}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {rows.map((r) => (
                      <tr key={String(r.id)} onClick={() => setDetailId(r.id as number)} className="row-hover cursor-pointer">
                        {visibleCols.map((c) => {
                          const f = metaByName.get(c);
                          const text = cellText(r[c], f);
                          const isId = c === "id";
                          return (
                            <td key={c} title={text}
                              className={`${isId ? "dataset-id font-mono font-semibold text-slate-200" : "text-slate-300"} px-3 py-2 whitespace-nowrap max-w-[280px] truncate ${f && ["integer", "float", "monetary"].includes(f.type) && !isId ? "text-right tabular-nums" : ""}`}>
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
                )}
                {!loading && !rows.length && !dataError && <p className="text-xs text-slate-500 text-center py-10">Sin resultados</p>}
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-white/[0.08] text-xs text-slate-500">
                <span>{total ? `Mostrando ${from}–${to} de ${total.toLocaleString("es-CO")}` : "—"}{etapa !== "ALL" ? ` · Etapa actual: ${etapa === EMPTY_VALUE ? "Sin etapa" : etapa}` : ""} · ordenado por {metaByName.get(sort.field)?.label ?? sort.field} {sort.dir === "asc" ? "↑" : "↓"}</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Página anterior" className="pill-option p-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-default"><ChevronLeft size={14} /></button>
                  <span className="tabular-nums">Pág. {page + 1} de {lastPage + 1}</span>
                  <button type="button" disabled={page >= lastPage || loading} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} aria-label="Página siguiente" className="pill-option p-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-default"><ChevronRight size={14} /></button>
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Buscar campo por nombre o etiqueta…" className={`${inputCls} pl-8 w-72`} />
              </div>
              <select value={catType} onChange={(e) => setCatType(e.target.value)} className={`cmmi-select ${inputCls}`} aria-label="Tipo de campo">
                {types.map((t) => <option key={t} value={t}>{t === "ALL" ? "Tipo: todos" : t}</option>)}
              </select>
              <button type="button" onClick={() => setCatCustom((v) => !v)} data-active={catCustom} className="pill-option px-3 py-2 rounded-lg text-xs font-medium border">Solo personalizados (x_)</button>
              <span className="flex-1" />
              <span className="text-xs text-slate-500">{catRows.length} de {meta.length} campos · {visibleCols.length} visibles en la tabla</span>
              <button type="button" onClick={() => setColsSaved(DEFAULT_COLS)} className="pill-option px-3 py-2 rounded-lg text-xs font-medium border">Restablecer columnas</button>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-250px)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide">
                      {["", "Etiqueta", "Campo técnico", "Tipo", "Relación / valores"].map((h) => (
                        <th key={h} className="dataset-head text-left font-semibold px-3 py-2.5 text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {catRows.map((f) => (
                      <tr key={f.name} className="row-hover">
                        <td className="px-3 py-2 w-8">
                          <input type="checkbox" checked={visibleCols.includes(f.name)} disabled={f.heavy || f.name === "id"} onChange={() => toggleCol(f.name)} aria-label={`Mostrar ${f.label}`} />
                        </td>
                        <td className="px-3 py-2 text-slate-200 font-medium whitespace-nowrap">{f.label}{f.required && <span className="text-rose-400"> *</span>}</td>
                        <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{f.name}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {f.type}{!f.stored && <span className="ml-1.5 text-[10px] text-slate-500">calculado</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-400 max-w-[420px]">
                          {f.heavy ? <span className="text-amber-500">Pesado: se excluye</span>
                            : f.relation ? f.relation
                            : f.selection ? <span title={f.selection.map(([v, l]) => `${v} = ${l}`).join("\n")}>{f.selection.map(([, l]) => l).join(" · ")}</span>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!metaRes && <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando catálogo…</div>}
              </div>
            </div>
          </>
        )}
      </main>

      {detailId !== null && <DetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/* ── panel lateral: todos los campos de un registro ─────────────────── */
function DetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [res, setRes] = useState<{ id: number; record?: Row; error?: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/odoo/dataset?model=${MODEL}&id=${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
        if (!cancelled) setRes({ id, record: j.record as Row });
      })
      .catch((e) => { if (!cancelled) setRes({ id, error: e instanceof Error ? e.message : "No se pudo leer el registro." }); });
    return () => { cancelled = true; };
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = !res || res.id !== id;
  const shown = useMemo(() => {
    if (!res?.record) return {};
    const nq = norm(filter.trim());
    return Object.fromEntries(Object.entries(res.record).filter(([k]) => !nq || norm(k).includes(nq)));
  }, [res, filter]);
  const json = JSON.stringify(shown, null, 2);

  return createPortal(
    <div className="dashboard-shell">
      <div className="fixed inset-0 z-50 backdrop-blur-sm" style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside role="dialog" aria-label={`Registro ${id}`}
          className="modal-panel backdrop-blur-2xl absolute right-0 top-0 h-full w-full max-w-[600px] shadow-2xl shadow-black/60 border-l border-white/[0.14] flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: mounted ? "translateX(0)" : "translateX(100%)" }}>
          <div className="app-bar modal-header flex items-center justify-between px-5 h-[60px] shrink-0 border-b border-white/[0.07]">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-100 text-sm uppercase tracking-wide">{MODEL} · ID {id}</h2>
              <p className="text-[11px] text-slate-400">{loading ? "Cargando…" : `${Object.keys(res?.record ?? {}).length} campos`}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={loading || !!res?.error}
                onClick={() => { navigator.clipboard?.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
                title="Copiar JSON" aria-label="Copiar JSON" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors disabled:opacity-50">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="px-5 pt-4 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar campos por nombre técnico…"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
            ) : res?.error ? (
              <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {res.error}
              </div>
            ) : (
              <pre className="text-[11px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words">{json}</pre>
            )}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
