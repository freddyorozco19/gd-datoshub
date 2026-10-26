"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, AlertCircle, Loader2, X, Maximize2, Settings } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";
import FilterSelect from "./FilterSelect";
import DateRangeSlider from "./DateRangeSlider";
import FitRow from "./FitRow";
import { uniqueEtapaActual } from "./etapaOrder";
import LeadDetailModal from "./LeadDetailModal";
import PresalesOcupacionModal from "./PresalesOcupacionModal";
import InfoTip, { type InfoContent } from "@/components/ui/InfoTip";
import UpdatedAgo from "@/components/ui/UpdatedAgo";
import PresalesKanbanBoard from "./PresalesKanbanBoard";
import PresalesCycleCard from "./PresalesCycleCard";
import PresalesAgendaCard from "./PresalesAgendaCard";
import PresalesPreventaModal from "./PresalesPreventaModal";
import PresalesSettingsPanel, { DEFAULT_PRESALES_SETTINGS, type PresalesSettings, type SectionId } from "./PresalesSettingsPanel";
import PresalesManageModal, { type PresalesStatusRow, type PresalesKind } from "./PresalesManageModal";

/* ── constantes de gestión ───────────────────────────────────────────── */
const DAY_MS     = 86400000;
const SETTINGS_KEY = "presales-settings-v1";
const SOON_DAYS  = 15;   // cierre esperado dentro de N días → próximo

/* ── helpers ─────────────────────────────────────────────────────────── */
const parseDate = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
};

const fmtCOP = (v: number) => {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)} M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
};

const unique = (arr: string[]) => ["ALL", ...Array.from(new Set(arr.filter(Boolean))).sort()];
const normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Odoo entrega create_date en UTC sin sufijo de zona ("YYYY-MM-DD HH:MM:SS"); se interpreta como
// UTC explicito y se muestra en hora Colombia (GMT-5), igual que el resto de la app.
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

// Compañías de Odoo: GROW DATA SAS (COP) y GROW DATA INTERNATIONAL SA (USD) — las monedas difieren, no se pueden sumar
type CompKey = "SAS" | "INT";
const compKey = (l: Lead): CompKey => (normText(l.compania).includes("international") ? "INT" : "SAS");
const fmtUSD = (v: number) => {
  if (!v) return "—";
  if (v >= 1e6) return `US$ ${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (v >= 1e3) return `US$ ${Math.round(v / 1e3)} mil`;
  return `US$ ${Math.round(v)}`;
};
// conteo por compañía de un conjunto de leads, en formato de desglose para las tarjetas
type KpiSplit = { label: string; short?: string; value: string; color: string; onClick?: () => void };
// onOpen: si se pasa, cada compañía queda clicable y abre el listado de sus leads
const splitBy = (arr: Lead[], fmt: (l: Lead[]) => string = (l) => String(l.length), onOpen?: (leads: Lead[], company: string) => void): KpiSplit[] => {
  const sas = arr.filter((l) => compKey(l) === "SAS");
  const int = arr.filter((l) => compKey(l) === "INT");
  return [
    { label: "GROW DATA", short: "GROW DATA", color: "bg-blue-400", value: fmt(sas), onClick: onOpen ? () => onOpen(sas, "GROW DATA") : undefined },
    { label: "GD INTERNATIONAL", short: "GD INTL", color: "bg-teal-400", value: fmt(int), onClick: onOpen ? () => onOpen(int, "GD INTERNATIONAL") : undefined },
  ];
};

/* color de la barra de Ocupación según el porcentaje */
const ocupColor = (p: number) => (p >= 100 ? "bg-rose-500" : p >= 70 ? "bg-amber-500" : "bg-blue-500");

const CARD = "relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden";

// fill: la tarjeta se estira a la altura que le da su contenedor y el contenido ocupa el espacio sobrante
function Card({ title, right, children, className = "", fill, info }: { title: string; right?: ReactNode; children: ReactNode; className?: string; fill?: boolean; info?: InfoContent }) {
  return (
    <div className={`${CARD} p-4 ${fill ? "flex flex-col" : ""} ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wide">{title}</h3>
          {info && <InfoTip {...info} />}
        </div>
        {right}
      </div>
      <div className={`relative ${fill ? "flex-1 min-h-0 flex flex-col" : ""}`}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, onClick, split, info }: { label: string; value: string; onClick?: () => void; split?: KpiSplit[]; info?: InfoContent }) {
  return (
    <div
      className={`${CARD} @container/k min-w-0 ${onClick ? "kpi-click cursor-pointer" : ""}`}
      {...(onClick ? {
        role: "button", tabIndex: 0, onClick,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
      } : {})}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      {/* Todo escala con el ancho de la propia tarjeta (cqw): la fila de 7 se mantiene en una línea
          y los textos se reducen proporcionalmente, con un mínimo para no volverse ilegibles. */}
      <div className="relative" style={{ padding: "clamp(8px, 7cqw, 16px)" }}>
        <div className="flex items-start justify-between gap-1">
          <p className="font-semibold text-slate-300 uppercase leading-tight break-words" title={label}
            style={{ fontSize: "clamp(9px, 6.4cqw, 12px)", letterSpacing: "0.05em" }}>{label}</p>
          {info && <InfoTip {...info} size={12} className="-mt-0.5 -mr-1" />}
        </div>
        <p className="font-bold text-slate-100 tabular-nums leading-none whitespace-nowrap"
          style={{ fontSize: "clamp(15px, 12.5cqw, 24px)", marginTop: "clamp(4px, 3.5cqw, 8px)" }}>{value}</p>
        {split && (
          <div className="border-t border-white/[0.08] space-y-1" style={{ marginTop: "clamp(6px, 5cqw, 10px)", paddingTop: "clamp(4px, 4cqw, 8px)" }}>
            {split.map((s) => {
              const inner = (
                <>
                  <span className="flex items-center gap-1.5 text-slate-500 whitespace-nowrap min-w-0 flex-1 overflow-hidden">
                    <i className={`w-2 h-2 rounded-sm shrink-0 ${s.color}`} />
                    {s.short && s.short !== s.label ? (
                      <>
                        <span className="@[210px]/k:hidden truncate" title={s.label}>{s.short}</span>
                        <span className="hidden @[210px]/k:inline truncate">{s.label}</span>
                      </>
                    ) : <span className="truncate" title={s.label}>{s.label}</span>}
                  </span>
                  <span className="text-slate-300 tabular-nums whitespace-nowrap shrink-0">{s.value}</span>
                </>
              );
              const style = { fontSize: "clamp(9px, 5.8cqw, 11px)" };
              return s.onClick ? (
                <button key={s.label} type="button" title={`Ver los leads de ${s.label}`}
                  onClick={(e) => { e.stopPropagation(); s.onClick!(); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="kpi-split flex w-full items-center justify-between gap-2 text-left rounded-md px-1.5 -mx-1.5 py-0.5 cursor-pointer" style={style}>
                  {inner}
                </button>
              ) : (
                <div key={s.label} className="flex items-center justify-between gap-2" style={style}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// etapas de preventa que no se muestran como columna en Carga por preventa (valores normalizados)
const HIDDEN_ETAPA_COLS = new Set(["oferta declinada", "no viable", "oferta no viable", "suspendida", "sin etapa"]);


/* ── vista ───────────────────────────────────────────────────────────── */
// popup con la tabla de leads (el mismo de la pestaña Business); se recibe por prop para no crear un import circular
export type LeadsListModalType = ComponentType<{ leads: Lead[]; title?: string; heading?: string; suffix?: string; showEstadoPreventaChips?: boolean; onClose: () => void }>;

export default function PresalesView({
  leads, loading, error, onReload, updatedAt, LeadsListModal,
}: { leads: Lead[]; loading: boolean; error: string | null; onReload: () => void; updatedAt?: Date | null; LeadsListModal: LeadsListModalType }) {
  const [listModal, setListModal] = useState<{ leads: Lead[]; heading: string; suffix?: string; chips?: boolean } | null>(null);
  const [fPreventa, setFPreventa] = useState("ALL");
  const [fLinea,    setFLinea]    = useState("ALL");
  // por defecto: Etapa Actual = Preventa, Estado Preventa = ABIERTO (se pueden cambiar libremente)
  const [fEtapa,    setFEtapa]    = useState("ABIERTO");
  const [fEstado,   setFEstado]   = useState("Preventa");
  const [dFrom,     setDFrom]     = useState("");
  const [dTo,       setDTo]       = useState("");
  const [selected,  setSelected]  = useState<Lead | null>(null);

  /* estado activo/inactivo de cada preventa (gestionado desde esta página) */
  const [statuses,   setStatuses]   = useState<Record<string, PresalesStatusRow>>({});
  const [canManage,  setCanManage]  = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsKind,  setNeedsKind]  = useState(false);
  // configuración de la vista (días para estancado, ocupación máxima, ocultar inactivos): se guarda en este navegador
  const [settings, setSettings] = useState<PresalesSettings>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SETTINGS_KEY) : null;
      return raw ? { ...DEFAULT_PRESALES_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PRESALES_SETTINGS;
    } catch { return DEFAULT_PRESALES_SETTINGS; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId | undefined>(undefined);
  const [showOcup, setShowOcup] = useState(false);
  const [fichaName, setFichaName] = useState<string | null>(null);   // ficha de preventa abierta
  const { staleDays: STALE_DAYS, maxOcupacion: CARGA_LIMIT, onlyActive } = settings;
  const saveSettings = (next: PresalesSettings) => {
    setSettings(next);
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: queda solo en memoria */ }
  };
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    fetch("/api/presales/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStatuses(Object.fromEntries((d.statuses as PresalesStatusRow[]).map((s) => [s.name, s])));
        setCanManage(!!d.canManage);
        setNeedsSetup(!!d.needsSetup);
        setNeedsKind(!!d.needsKind);
      })
      .catch(() => {});
  }, []);

  const isInactive = (name: string) => statuses[name]?.active === false;
  const kindOf = (name: string): PresalesKind => statuses[name]?.kind ?? "profesional";
  // la ocupación global solo cuenta a los preventas profesionales (líderes y gerentes se muestran pero no suman)
  const isProf = (name: string) => kindOf(name) === "profesional";

  async function saveStatuses(changes: { name: string; active: boolean; kind: PresalesKind }[]) {
    const res = await fetch("/api/presales/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    const saved = json.statuses as PresalesStatusRow[];
    const kindByName = new Map(changes.map((c) => [c.name, c.kind]));
    setStatuses((prev) => ({ ...prev, ...Object.fromEntries(saved.map((s) => [s.name, { ...s, kind: kindByName.get(s.name) ?? s.kind ?? "profesional" }])) }));
    setNeedsSetup(false);
    if (json.kindSaved === false) setNeedsKind(true);
  }

  /* universo de preventa: leads con preventa asignado, con Estado Preventa, o en Etapa Actual = Preventa
     (este último evita que la tarjeta Estado preventa cuente leads que el resto de la vista no ve) */
  // filtro Compañía: "ALL" o el nombre exacto de la compañía en Odoo
  const [fCompania, setFCompania] = useState("ALL");
  const companias = useMemo(() => ["ALL", ...Array.from(new Set(leads.map((l) => l.compania).filter(Boolean))).sort().reverse()], [leads]);
  const leadsC = useMemo(() => (fCompania === "ALL" ? leads : leads.filter((l) => l.compania === fCompania)), [leads, fCompania]);

  const scope = useMemo(() => leadsC.filter((l) => l.preventa || l.etapaPreventa || normText(l.etapa) === "preventa"), [leadsC]);

  const opts = useMemo(() => ({
    preventa:    unique(scope.map((l) => l.preventa).filter((n) => !onlyActive || statuses[n]?.active !== false)),
    linea:       unique(scope.map((l) => l.linea)),
    etapaPreventa: unique(scope.map((l) => l.etapaPreventa)),
    etapaActual: uniqueEtapaActual(scope.map((l) => l.etapa)),
  }), [scope, onlyActive, statuses]);

  const filtered = useMemo(() => scope.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (fEtapa    === "ALL" || l.etapaPreventa === fEtapa) &&
    (fEstado   === "ALL" || l.etapa === fEstado) &&
    (!dFrom || l.fechaCreacion >= dFrom) &&
    (!dTo   || l.fechaCreacion.substring(0, 10) <= dTo)
  ), [scope, fPreventa, fLinea, fEtapa, fEstado, dFrom, dTo]);

  // igual que "filtered" pero sin el filtro Estado Preventa — para el widget que grafica justamente ese campo,
  // que si no se veria siempre reducido a un solo valor por el propio filtro
  const filteredAnyEstadoPreventa = useMemo(() => scope.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (fEstado   === "ALL" || l.etapa === fEstado) &&
    (!dFrom || l.fechaCreacion >= dFrom) &&
    (!dTo   || l.fechaCreacion.substring(0, 10) <= dTo)
  ), [scope, fPreventa, fLinea, fEstado, dFrom, dTo]);

  // leads cuya Etapa Actual es "Preventa" — criterio propio de la primera tarjeta, por eso ignora los filtros
  // Etapa Actual y Estado Preventa (respeta Línea, Preventa, fecha y Solo activos)
  const enEtapaPreventa = useMemo(() => leadsC.filter((l) =>
    normText(l.etapa) === "preventa" &&
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (!dFrom || l.fechaCreacion >= dFrom) &&
    (!dTo   || l.fechaCreacion.substring(0, 10) <= dTo) &&
    (!onlyActive || !l.preventa || statuses[l.preventa]?.active !== false)
  ), [leadsC, fPreventa, fLinea, dFrom, dTo, onlyActive, statuses]);

  /* límites del slider de fecha — del primer lead cargado a hoy (igual que Business) */
  const dateBounds = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    const days = scope.map((l) => l.fechaCreacion.substring(0, 10)).filter(Boolean).sort();
    if (!days.length) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return { min: d.toISOString().substring(0, 10), max: today };
    }
    return { min: days[0], max: days[days.length - 1] > today ? days[days.length - 1] : today };
  }, [scope]);

  const activeFilters = [fPreventa, fLinea, fEtapa, fEstado, fCompania].filter((v) => v !== "ALL").length + (dFrom || dTo ? 1 : 0);
  const clearFilters = () => { setFPreventa("ALL"); setFLinea("ALL"); setFEtapa("ALL"); setFEstado("ALL"); setFCompania("ALL"); setDFrom(""); setDTo(""); };

  const [now] = useState(() => Date.now());
  const daysSince = (l: Lead) => {
    const d = parseDate(l.ultimaModificacion);
    return d ? Math.floor((now - d.getTime()) / DAY_MS) : 0;
  };
  const daysToClose = (l: Lead) => {
    const d = parseDate(l.cierreEsperado);
    return d ? Math.ceil((d.getTime() - now) / DAY_MS) : null;
  };
  // "Abierto" = el campo Etapa Prev. está en Abierto
  const isOpen = (l: Lead) => normText(l.etapaPreventa) === "abierto";

  /* KPIs */
  const stats = useMemo(() => {
    const open    = filtered.filter(isOpen);
    const won     = filtered.filter((l) => l.ganado === "Ganado");
    const lost    = filtered.filter((l) => l.ganado === "Perdido");
    const sinAsig = open.filter((l) => !l.preventa);
    const stale   = open.filter((l) => daysSince(l) > STALE_DAYS);
    const soon    = open.filter((l) => { const d = daysToClose(l); return d !== null && d >= 0 && d <= SOON_DAYS; });
    return {
      total: filtered.length, open, won, lost, sinAsig, stale, soon,
      pipeline: open.reduce((s, l) => s + l.ingresosEsperados, 0),
      winRate: pct(won.length, won.length + lost.length),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  /* carga por preventa */
  // Una columna por cada valor real del campo Etapa Prev. (además de Abierto), en vez de valores supuestos.
  // todos los preventas conocidos (los de cualquier lead y los de la tabla de estados): aparecen en la tabla aunque tengan 0 leads
  const allPreventas = useMemo(
    () => Array.from(new Set([...leads.map((l) => l.preventa), ...Object.keys(statuses)].filter(Boolean))).sort(),
    [leads, statuses],
  );
  type CargaRow = { name: string; open: number; won: number; lost: number; pipeline: number; stale: number; counts: Record<string, number> };
  function buildCarga(src: Lead[]) {
    const map = new Map<string, CargaRow>();
    const labels = new Map<string, string>();   // valor normalizado → etiqueta original
    const totals = new Map<string, number>();
    for (const l of src) {
      const name = l.preventa || "Sin asignar";
      const r = map.get(name) ?? { name, open: 0, won: 0, lost: 0, pipeline: 0, stale: 0, counts: {} };
      if (l.ganado === "Ganado") r.won++;
      else if (l.ganado === "Perdido") r.lost++;
      const key = normText(l.etapaPreventa) || "sin etapa";
      if (!labels.has(key)) labels.set(key, l.etapaPreventa || "Sin etapa");
      totals.set(key, (totals.get(key) ?? 0) + 1);
      r.counts[key] = (r.counts[key] ?? 0) + 1;
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; if (daysSince(l) > STALE_DAYS) r.stale++; }
      map.set(name, r);
    }
    const cols = [...totals.keys()]
      .filter((k) => k !== "abierto" && !HIDDEN_ETAPA_COLS.has(k))
      .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
      .map((k) => ({ key: k, label: labels.get(k) ?? k }));
    const rows = [...map.values()].sort((a, b) => b.open - a.open || Object.values(b.counts).reduce((s, n) => s + n, 0) - Object.values(a.counts).reduce((s, n) => s + n, 0));
    // preventas sin ningún lead en este alcance: se agregan con carga 0 (respetando el filtro Preventa)
    for (const name of allPreventas) {
      if (map.has(name) || (fPreventa !== "ALL" && name !== fPreventa)) continue;
      rows.push({ name, open: 0, won: 0, lost: 0, pipeline: 0, stale: 0, counts: {} });
    }
    return { rows, cols };
  }
  const { byPreventa, etapaCols } = useMemo(() => {
    const r = buildCarga(filtered);
    return { byPreventa: r.rows, etapaCols: r.cols };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);
  // con "Solo activos" la tabla oculta a los inactivos; los indicadores de arriba conservan el histórico completo
  const tableRows = onlyActive ? byPreventa.filter((r) => !isInactive(r.name)) : byPreventa;

  const totals = {
    open:     tableRows.reduce((s, r) => s + r.open, 0),
    won:      tableRows.reduce((s, r) => s + r.won, 0),
    lost:     tableRows.reduce((s, r) => s + r.lost, 0),
    pipeline: tableRows.reduce((s, r) => s + r.pipeline, 0),
    stale:    tableRows.reduce((s, r) => s + r.stale, 0),
    counts:   Object.fromEntries(etapaCols.map((c) => [c.key, tableRows.reduce((s, r) => s + (r.counts[c.key] ?? 0), 0)])) as Record<string, number>,
  };

  /* tarjetas por compañía */
  const showSplit = fCompania === "ALL";   // con una compañía filtrada, el número principal ya es solo de ella
  // mismos leads que suma la columna Abiertos de la tabla (respeta filtros y Solo activos)
  const abiertosNames = new Set(tableRows.map((r) => r.name));
  const abiertosLeads = filtered.filter((l) => isOpen(l) && abiertosNames.has(l.preventa || "Sin asignar"));
  // ocupación: misma base que la columna Ocupación de la tabla (preventas listados × límite de Configuración)
  const profRows = tableRows.filter((r) => isProf(r.name));
  const profOpen = profRows.reduce((s, r) => s + r.open, 0);
  const ocupGlobal = profRows.length ? Math.round((profOpen / (CARGA_LIMIT * profRows.length)) * 100) : 0;
  const ocupAlerta = profRows.filter((r) => (r.open / CARGA_LIMIT) >= 0.7).length;
  const ocupLimite = profRows.filter((r) => (r.open / CARGA_LIMIT) >= 1).length;
  /* "Cómo se calcula": regla en una frase + campo de Odoo de cada cifra y panel */
  const INFO: Record<string, InfoContent> = {
    estado: { rule: "Leads cuya Etapa Actual es Preventa. Respeta Línea, Preventa, Compañía, el rango de fechas (fecha de creación) y Preventas inactivos; ignora los filtros Etapa Actual y Estado Preventa.", fields: ["x_studio_etapa_actual", "x_studio_preventa", "x_studio_linea", "company_id", "create_date"] },
    abierta: { rule: "Leads con Estado Preventa = ABIERTO de los preventas que aparecen en la tabla Carga por preventa, dentro de los filtros de la página.", fields: ["x_studio_edopreventa", "x_studio_preventa"] },
    pipeline: { rule: "Suma del ingreso esperado de los leads abiertos. GROW DATA va en COP y GD INTERNATIONAL en USD: nunca se suman entre sí.", fields: ["expected_revenue", "company_id", "x_studio_edopreventa"] },
    ocupacion: { rule: `Leads abiertos de los preventas Profesionales ÷ (máximo por preventa × número de profesionales). Líderes y gerentes se muestran pero no cuentan. En alerta: 70 % o más. Al límite: 100 % o más.`, note: `Máximo actual: ${CARGA_LIMIT} leads por preventa (Configuración). El rol se asigna en Gestionar preventas.`, fields: ["x_studio_edopreventa", "x_studio_preventa"] },
    sinPreventa: { rule: "Leads abiertos que todavía no tienen preventa asignado.", fields: ["x_studio_preventa", "x_studio_edopreventa"] },
    estancados: { rule: `Leads abiertos con más de ${STALE_DAYS} días sin ninguna modificación.`, note: "El número de días se cambia en Configuración.", fields: ["write_date", "x_studio_edopreventa"] },
    cierre: { rule: `Leads abiertos con cierre esperado dentro de los próximos ${SOON_DAYS} días (hoy incluido).`, fields: ["date_deadline", "x_studio_edopreventa"] },
    carga: { rule: `Una fila por preventa. Abiertos: leads con Estado Preventa ABIERTO. Ocupación: abiertos ÷ máximo configurado (${CARGA_LIMIT}). Pipeline: ingreso esperado de sus abiertos. Estancados: abiertos con más de ${STALE_DAYS} días sin cambios.`, fields: ["x_studio_preventa", "x_studio_edopreventa", "expected_revenue", "write_date"] },
    porEstado: { rule: "Leads con Etapa Actual = Preventa agrupados por su Estado Preventa. Las pills Activo / Inactivo filtran por el campo active del lead (inactivo = archivado en Odoo).", fields: ["x_studio_edopreventa", "x_studio_etapa_actual", "active"] },
    porAnio: { rule: "Asignadas: primera vez que el lead pasa a la etapa Preventa. Cerradas: veces que el Estado Preventa pasa de ABIERTO a CERRADO. Un lead cuenta una vez por mes.", note: "Sale del historial de cambios de Odoo; el del Estado Preventa existe desde julio de 2025.", fields: ["stage_id (historial)", "x_studio_edopreventa (historial)", "create_date"] },
    ciclo: { rule: "Días entre que un lead pasa a ABIERTO y pasa a CERRADO. Un lead reabierto cuenta como un ciclo nuevo. Se incluyen los ciclos cerrados en el año elegido.", note: "Del historial del Estado Preventa (desde julio de 2025).", fields: ["x_studio_edopreventa (historial)", "x_studio_preventa"] },
    agenda: { rule: "Leads abiertos con fecha de cierre esperada, agrupados por semana. Rojo: faltan 7 días o menos; ámbar: hasta 15; verde: más.", fields: ["date_deadline", "x_studio_edopreventa"] },
    tablero: { rule: "Una columna por Estado Preventa con los leads de Etapa Actual = Preventa que pasan los filtros de la página. Los filtros del propio tablero no afectan al resto.", fields: ["x_studio_edopreventa", "x_studio_etapa_actual"] },
  };
  const ocupNames = (min: number) => new Set(profRows.filter((r) => (r.open / CARGA_LIMIT) >= min).map((r) => r.name));
  // el pipeline NO se suma entre compañías: SAS está en COP e Internacional en USD
  const pipelineCOP = stats.open.filter((l) => compKey(l) === "SAS").reduce((s, l) => s + l.ingresosEsperados, 0);
  const pipelineUSD = stats.open.filter((l) => compKey(l) === "INT").reduce((s, l) => s + l.ingresosEsperados, 0);
  const fmtPipeline = fCompania !== "ALL" && compKey({ compania: fCompania } as Lead) === "INT" ? fmtUSD(pipelineUSD) : fmtCOP(pipelineCOP);

  /* personas para la ventana de gestión: todos los preventas de ODOO, sin depender de los filtros */
  const people = useMemo(() => {
    const map = new Map<string, { name: string; open: number; total: number }>();
    for (const l of scope) {
      if (!l.preventa) continue;
      const r = map.get(l.preventa) ?? { name: l.preventa, open: 0, total: 0 };
      r.total++;
      if (normText(l.etapaPreventa) === "abierto") r.open++;
      map.set(l.preventa, r);
    }
    return [...map.values()];
  }, [scope]);

  /* Estado Preventa (todas las etapas) — respeta "Solo activos" pero no el propio filtro Estado Preventa.
     Filtro propio del widget: lead activo/inactivo en Odoo (campo "active" del lead, columna Activo de Business). */
  const [fLeadActivo, setFLeadActivo] = useState<"ALL" | "true" | "false">("ALL");
  const etapaScope = useMemo(() => {
    const base = onlyActive ? filteredAnyEstadoPreventa.filter((l) => !l.preventa || !isInactive(l.preventa)) : filteredAnyEstadoPreventa;
    return fLeadActivo === "ALL" ? base : base.filter((l) => String(l.activo) === fLeadActivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAnyEstadoPreventa, onlyActive, statuses, fLeadActivo]);
  const byEtapa = useMemo(() => {
    const map = new Map<string, { name: string; count: number; open: number; pipeline: number; days: number }>();
    for (const l of etapaScope) {
      const name = l.etapaPreventa || "Sin etapa";
      const r = map.get(name) ?? { name, count: 0, open: 0, pipeline: 0, days: 0 };
      r.count++;
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; r.days += daysSince(l); }
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaScope]);
  const maxEtapa = Math.max(1, ...byEtapa.map((r) => r.count));

  /* Leads por año: "asignadas" = primera vez que la Etapa actual del lead pasa a Preventa; "cerradas" = el Estado Preventa
     pasa de ABIERTO a CERRADO. Las fechas salen del historial de Odoo (/api/presales/timeline); respeta Línea, Preventa,
     Compañía y Preventas inactivos, pero no Etapa actual, Estado Preventa ni el rango de fechas (el año se elige en el widget). */
  const [timeline, setTimeline] = useState<PresalesTimeline | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/presales/timeline")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
        if (!cancelled) setTimeline(j as PresalesTimeline);
      })
      .catch((e) => { if (!cancelled) setTimelineError(e instanceof Error ? e.message : "No se pudo leer el historial."); });
    return () => { cancelled = true; };
  }, []);
  const [mHover, setMHover] = useState<string | null>(null);
  const thisYear = new Date().getFullYear();
  const [cYear, setCYear] = useState(thisYear);
  type Seg = "Año" | "S1" | "S2" | "Q1" | "Q2" | "Q3" | "Q4";
  const SEG_RANGE: Record<Seg, [number, number]> = { "Año": [0, 12], S1: [0, 6], S2: [6, 12], Q1: [0, 3], Q2: [3, 6], Q3: [6, 9], Q4: [9, 12] };
  const SEG_LABEL: Record<Seg, string> = { "Año": "Año completo", S1: "S1 · Ene–Jun", S2: "S2 · Jul–Dic", Q1: "Q1 · Ene–Mar", Q2: "Q2 · Abr–Jun", Q3: "Q3 · Jul–Sep", Q4: "Q4 · Oct–Dic" };
  const [cSeg, setCSeg] = useState<Seg>("Año");
  const chartYears = useMemo(() => {
    const first = timeline?.since ? Number(timeline.since.slice(0, 4)) : thisYear;
    return Array.from({ length: thisYear - Math.min(first, thisYear) + 1 }, (_, i) => thisYear - i);
  }, [timeline, thisYear]);
  const chartScope = useMemo(() => leadsC.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (!onlyActive || !l.preventa || statuses[l.preventa]?.active !== false)
  ), [leadsC, fPreventa, fLinea, onlyActive, statuses]);
  const [cycYear, setCycYear] = useState<number | "ALL">(new Date().getFullYear());
  const agendaLeads = useMemo(() => chartScope.filter((l) => isOpen(l) && !!l.cierreEsperado), [chartScope]);
  const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const chartMonths = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      key: `${cYear}-${String(i + 1).padStart(2, "0")}`,
      label: MES[i],
      full: new Date(cYear, i, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
      assigned: [] as Lead[],
      closed: [] as Lead[],
    }));
    if (!timeline) return months;
    const closesBy = new Map<number, string[]>();
    for (const c of timeline.closes) closesBy.set(c.leadId, [...(closesBy.get(c.leadId) ?? []), c.date]);
    const yr = String(cYear);
    for (const l of chartScope) {
      // los leads creados directamente en Preventa no tienen evento de entrada: se usa su fecha de creación
      const entry = timeline.entries[String(l.id)] ?? (normText(l.etapa) === "preventa" ? l.fechaCreacion : null);
      if (entry && entry.startsWith(yr)) months[Number(entry.slice(5, 7)) - 1].assigned.push(l);
      const seen = new Set<number>();
      for (const d of closesBy.get(l.id) ?? []) {
        if (!d.startsWith(yr)) continue;
        const mi = Number(d.slice(5, 7)) - 1;
        if (!seen.has(mi)) { seen.add(mi); months[mi].closed.push(l); }   // un lead cuenta una vez por mes
      }
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, chartScope, cYear]);
  const shownMonths = chartMonths.slice(SEG_RANGE[cSeg][0], SEG_RANGE[cSeg][1]);
  const chartTotals = {
    assigned: shownMonths.reduce((s, m) => s + m.assigned.length, 0),
    closed:   shownMonths.reduce((s, m) => s + m.closed.length, 0),
  };
  const maxMonth = Math.max(1, ...shownMonths.flatMap((m) => [m.assigned.length, m.closed.length]));
  const stackMonth = fCompania === "ALL";   // barra de asignadas apilada por compañía
  const monthLines = (arr: Lead[]) => fCompania !== "ALL" ? [] : [
    { label: "GROW DATA", value: String(arr.filter((l) => compKey(l) === "SAS").length) },
    { label: "GD INTL", value: String(arr.filter((l) => compKey(l) === "INT").length) },
  ];

  /* widget Carga por preventa: pills de compañía propias (no afectan a las tarjetas) y vista ampliada */
  const [fCargaComp, setFCargaComp] = useState<"ALL" | CompKey>("ALL");
  const [cargaExpanded, setCargaExpanded] = useState(false);
  useEffect(() => {
    if (!cargaExpanded || listModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCargaExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cargaExpanded, listModal]);
  const cargaSrc = fCargaComp === "ALL" ? filtered : filtered.filter((l) => compKey(l) === fCargaComp);
  const carga = buildCarga(cargaSrc);
  const cargaRows = onlyActive ? carga.rows.filter((r) => !isInactive(r.name)) : carga.rows;
  const cargaTotals = {
    open:     cargaRows.reduce((s, r) => s + r.open, 0),
    won:      cargaRows.reduce((s, r) => s + r.won, 0),
    lost:     cargaRows.reduce((s, r) => s + r.lost, 0),
    pipeline: cargaRows.reduce((s, r) => s + r.pipeline, 0),
    stale:    cargaRows.reduce((s, r) => s + r.stale, 0),
    counts:   Object.fromEntries(carga.cols.map((c) => [c.key, cargaRows.reduce((s, r) => s + (r.counts[c.key] ?? 0), 0)])) as Record<string, number>,
  };
  const cargaProf = cargaRows.filter((r) => isProf(r.name));
  const cargaOcup = cargaProf.length ? Math.round((cargaProf.reduce((s, r) => s + r.open, 0) / (CARGA_LIMIT * cargaProf.length)) * 100) : 0;
  // con solo Internacional el pipeline está en USD; con SAS o todas, en COP (ver nota de monedas arriba)
  const fmtCargaPipe = fCargaComp === "INT" ? fmtUSD : fmtCOP;

  const cargaPills = (
    <div className="flex items-center gap-1">
      {([["ALL", "Todos"], ["SAS", "GROW DATA"], ["INT", "GROW DATA INTERNATIONAL"]] as const).map(([k, label]) => (
        <button key={k} type="button" onClick={() => setFCargaComp(k === "ALL" || fCargaComp === k ? "ALL" : k)}
          data-active={fCargaComp === k}
          className="pill-option text-[10px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap">
          {label}
        </button>
      ))}
    </div>
  );

  // En el panel, encabezado y Total quedan fuera del área con scroll (tres bloques con las mismas columnas);
  // el ancho de la barra de scroll se mide para que las columnas de los tres bloques sigan alineadas.
  const cargaBodyRef = useRef<HTMLDivElement>(null);
  const [cargaSbw, setCargaSbw] = useState(0);
  useLayoutEffect(() => {
    const el = cargaBodyRef.current;
    if (!el) return;
    const measure = () => setCargaSbw(el.offsetWidth - el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cargaRows.length, fCargaComp]);

  const renderCargaTable = (big: boolean) => {
    if (cargaRows.length === 0) return <p className="text-xs text-slate-500 py-6 text-center">Sin datos</p>;
    const py = big ? "py-2.5" : "py-2";
    const extra = carga.cols.length * 9;
    const wPrev = Math.max(22, 34 - extra);
    const colgroup = (
      <colgroup>
        <col style={{ width: `${wPrev}%` }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "27%" }} />
        {carga.cols.map((c) => <col key={c.key} style={{ width: "9%" }} />)}
        <col style={{ width: "15%" }} />
        <col style={{ width: "13%" }} />
      </colgroup>
    );
    const head = (
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-slate-500">
          <th className="text-left font-semibold pb-2 pr-3">Preventa</th>
          <th className="text-right font-semibold pb-2 px-2">Abiertos</th>
          <th className="text-left font-semibold pb-2 pl-3 pr-3">Ocupación</th>
          {carga.cols.map((c) => (
            <th key={c.key} className="text-right font-semibold pb-2 px-2 whitespace-nowrap">{c.label}</th>
          ))}
          <th className="text-right font-semibold pb-2 px-2">Pipeline</th>
          <th className="text-right font-semibold pb-2 pl-2">Estancados</th>
        </tr>
      </thead>
    );
    const body = (
      <tbody className="divide-y divide-white/[0.05]">
        {cargaRows.map((r) => {
          const ocup = Math.round((r.open / CARGA_LIMIT) * 100);
          return (
            <tr key={r.name}
              onClick={() => setListModal({ leads: cargaSrc.filter((l) => isOpen(l) && (l.preventa || "Sin asignar") === r.name), heading: r.name })}
              className="row-hover cursor-pointer">
              <td className={`${py} pr-3 font-medium truncate ${r.name === "Sin asignar" ? "text-amber-400" : "text-slate-200"}`} title={r.name}>{r.name === "Sin asignar" ? r.name : (
                <button type="button" onClick={(e) => { e.stopPropagation(); setFichaName(r.name); }}
                  className="name-link block max-w-full truncate text-left" title={`Abrir la ficha de ${r.name}`}>{r.name}</button>
              )}</td>
              <td className={`${py} px-2 text-right tabular-nums text-slate-300`}>{r.open}</td>
              <td className={`${py} pl-3 pr-3`}>
                <div className="flex items-center gap-2" title={`${r.open} de ${CARGA_LIMIT} leads abiertos`}>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className={`h-full rounded-full ${ocupColor(ocup)}`} style={{ width: `${Math.min(100, ocup)}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-slate-300">{ocup}%</span>
                </div>
              </td>
              {carga.cols.map((c) => {
                const n = r.counts[c.key] ?? 0;
                return (
                  <td key={c.key} className={`${py} px-2 text-right tabular-nums ${n === 0 ? "text-slate-600" : c.key === "ganado" ? "text-emerald-400" : "text-slate-300"}`}>{n}</td>
                );
              })}
              <td className={`${py} px-2 text-right tabular-nums text-slate-300 whitespace-nowrap`}>{fmtCargaPipe(r.pipeline)}</td>
              <td className={`${py} pl-2 text-right tabular-nums ${r.stale > 0 ? "text-rose-400 font-semibold" : "text-slate-500"}`}>{r.stale}</td>
            </tr>
          );
        })}
      </tbody>
    );
    const foot = (
      <tfoot>
        <tr
          onClick={() => {
            const names = new Set(cargaRows.map((r) => r.name));
            setListModal({ leads: cargaSrc.filter((l) => isOpen(l) && names.has(l.preventa || "Sin asignar")), heading: "Total" });
          }}
          className="border-t border-white/[0.14] font-semibold cursor-pointer row-hover">
          <td className="py-2.5 pr-3 text-slate-200 uppercase text-[10px] tracking-wide">Total</td>
          <td className="py-2.5 px-2 text-right tabular-nums text-slate-100">{cargaTotals.open}</td>
          <td className="py-2.5 pl-3 pr-3">
            <div className="flex items-center gap-2" title={`Ocupación global (solo profesionales): ${cargaProf.reduce((s, r) => s + r.open, 0)} de ${CARGA_LIMIT * cargaProf.length}`}>
              <div className="flex-1" />
              <span className="w-10 text-right tabular-nums text-slate-100">{cargaOcup}%</span>
            </div>
          </td>
          {carga.cols.map((c) => (
            <td key={c.key} className="py-2.5 px-2 text-right tabular-nums text-slate-100">{cargaTotals.counts[c.key]}</td>
          ))}
          <td className="py-2.5 px-2 text-right tabular-nums text-slate-100 whitespace-nowrap">{fmtCargaPipe(cargaTotals.pipeline)}</td>
          <td className="py-2.5 pl-2 text-right tabular-nums text-slate-100">{cargaTotals.stale}</td>
        </tr>
      </tfoot>
    );
    const tbl = "w-full table-fixed " + (big ? "text-sm" : "text-xs");

    if (big) {
      return (
        <div className="overflow-x-auto">
          <table className={tbl}>{colgroup}{head}{body}{foot}</table>
        </div>
      );
    }
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0" style={{ paddingRight: cargaSbw }}><table className={tbl}>{colgroup}{head}</table></div>
        <div ref={cargaBodyRef} className="flex-1 min-h-0 overflow-y-auto"><table className={tbl}>{colgroup}{body}</table></div>
        <div className="shrink-0" style={{ paddingRight: cargaSbw }}><table className={tbl}>{colgroup}{foot}</table></div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-5 space-y-4 relative">
      {/* filtros */}
      <FitRow
        left={<>
        <FilterSelect label="Línea"         value={fLinea}    onChange={setFLinea}    options={opts.linea} />
        <FilterSelect label="Preventa"       value={fPreventa} onChange={setFPreventa} options={opts.preventa} />
        <FilterSelect label="Etapa Actual"   value={fEstado}   onChange={setFEstado}   options={opts.etapaActual} />
        <FilterSelect label="Estado Preventa" value={fEtapa}   onChange={setFEtapa}    options={opts.etapaPreventa} />
        <FilterSelect label="Compañía"       value={fCompania} onChange={setFCompania} options={companias} widthClass="w-44"
          headerAction={activeFilters > 0 && (
            <button type="button" onClick={clearFilters} title={`Limpiar filtros (${activeFilters})`} className="text-slate-500 hover:text-rose-400 transition-colors">
              <X size={11} />
            </button>
          )} />

        <div className="w-px self-stretch bg-white/[0.08] shrink-0 mx-0.5" />

        <DateRangeSlider
          min={dateBounds.min}
          max={dateBounds.max}
          from={dFrom}
          to={dTo}
          onChange={(from, to) => { setDFrom(from); setDTo(to); }}
        />
        </>}
        right={<>
          <button type="button" onClick={() => { setSettingsSection(undefined); setShowSettings(true); }}
            className="pill-option flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border">
            <Settings size={13} /> Configuración
          </button>
          <UpdatedAgo at={updatedAt ?? null} />
          <button onClick={onReload} disabled={loading} title="Actualizar" aria-label="Actualizar"
            className="pill-option flex items-center justify-center p-2.5 rounded-lg border disabled:opacity-60 disabled:cursor-default">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </>}
      />

      {canManage && needsKind && !needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          El tipo de preventa (Profesional, Líder, Gerente) aún no se puede guardar: falta la columna kind en Supabase. Ejecuta supabase/migrations/20261018_presales_status_kind.sql en el SQL Editor.
        </div>
      )}
      {canManage && needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          La tabla presales_status aún no está creada en Supabase, por eso todos los preventas figuran como activos. Ejecuta supabase/migrations/20260921_presales_status.sql en el SQL Editor.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading && leads.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-500 text-sm">
          <Loader2 size={18} className="animate-spin" /> Cargando preventas…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div>
            <div className="grid grid-cols-7 gap-2 xl:gap-3">
            <Kpi label="Estado preventa" info={INFO.estado} value={String(enEtapaPreventa.length)}
              split={showSplit ? splitBy(enEtapaPreventa, undefined, (ls, c) => setListModal({ leads: ls, heading: `Estado preventa · ${c}`, suffix: " con Etapa Actual Preventa", chips: true })) : undefined}
              onClick={() => setListModal({ leads: enEtapaPreventa, heading: "Estado preventa", suffix: " con Etapa Actual Preventa", chips: true })} />
            <Kpi label="Preventa abierta" info={INFO.abierta} value={String(totals.open)}
              split={showSplit ? splitBy(abiertosLeads, undefined, (ls, c) => setListModal({ leads: ls, heading: `Preventa abierta · ${c}` })) : undefined}
              onClick={() => setListModal({ leads: abiertosLeads, heading: "Preventa abierta" })} />
            <Kpi label="Pipeline abierto" info={INFO.pipeline} value={fmtPipeline}
              split={showSplit ? [
                { label: "GROW DATA", short: "GROW DATA", color: "bg-blue-400", value: fmtCOP(pipelineCOP),
                  onClick: () => setListModal({ leads: stats.open.filter((l) => compKey(l) === "SAS"), heading: "Pipeline abierto · GROW DATA" }) },
                { label: "GD INTERNATIONAL", short: "GD INTL", color: "bg-teal-400", value: fmtUSD(pipelineUSD),
                  onClick: () => setListModal({ leads: stats.open.filter((l) => compKey(l) === "INT"), heading: "Pipeline abierto · GD INTERNATIONAL" }) },
              ] : undefined} />
            <Kpi label="Ocupación" info={INFO.ocupacion} value={`${ocupGlobal}%`}
              split={[
                { label: "En alerta (≥ 70 %)", short: "Alerta ≥ 70 %", color: "bg-amber-400", value: String(ocupAlerta),
                  onClick: () => setListModal({ leads: abiertosLeads.filter((l) => ocupNames(0.7).has(l.preventa || "Sin asignar")), heading: "Ocupación · preventas en alerta (≥ 70 %)" }) },
                { label: "Al límite (≥ 100 %)", short: "Al límite", color: "bg-rose-400", value: String(ocupLimite),
                  onClick: () => setListModal({ leads: abiertosLeads.filter((l) => ocupNames(1).has(l.preventa || "Sin asignar")), heading: "Ocupación · preventas al límite (≥ 100 %)" }) },
              ]}
              onClick={() => setShowOcup(true)} />
            <Kpi label="Sin preventa" info={INFO.sinPreventa} value={String(stats.sinAsig.length)}
              split={showSplit ? splitBy(stats.sinAsig, undefined, (ls, c) => setListModal({ leads: ls, heading: `Sin preventa · ${c}` })) : undefined}
              onClick={() => setListModal({ leads: stats.sinAsig, heading: "Sin preventa" })} />
            <Kpi label="Estancados" info={INFO.estancados} value={String(stats.stale.length)}
              split={showSplit ? splitBy(stats.stale, undefined, (ls, c) => setListModal({ leads: ls, heading: `Estancados · ${c}` })) : undefined}
              onClick={() => setListModal({ leads: stats.stale, heading: "Estancados" })} />
            <Kpi label="Cierre próximo" info={INFO.cierre} value={String(stats.soon.length)}
              split={showSplit ? splitBy(stats.soon, undefined, (ls, c) => setListModal({ leads: ls, heading: `Cierre próximo · ${c}` })) : undefined}
              onClick={() => setListModal({ leads: stats.soon, heading: "Cierre próximo" })} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 xl:h-[420px]">
            {/* carga por preventa */}
            <Card title="Carga por preventa" info={INFO.carga} className="xl:col-span-3" fill
              right={
                <div className="flex items-center gap-2">
                  {cargaPills}
                  <button type="button" onClick={() => setCargaExpanded(true)} title="Ampliar"
                    className="p-1 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-white/[0.06] transition-colors">
                    <Maximize2 size={13} />
                  </button>
                </div>
              }>
              {renderCargaTable(false)}
            </Card>

            <div className="xl:col-span-2 flex flex-col gap-4 min-h-0">
            {/* embudo por etapa */}
            <Card title="Leads en estado de preventa" info={INFO.porEstado} className="flex-1" fill
              right={
                <div className="flex items-center gap-1">
                  {([["ALL", "Todos"], ["true", "Activo"], ["false", "Inactivo"]] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setFLeadActivo(v)}
                      title="Filtra por el campo Activo del lead"
                      data-active={fLeadActivo === v}
                      className="pill-option text-[10px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap">
                      {label}
                    </button>
                  ))}
                </div>
              }>
              {byEtapa.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin datos</p>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col justify-between">
                  {byEtapa.map((r) => (
                    <button key={r.name} type="button"
                      onClick={() => setListModal({ leads: etapaScope.filter((l) => (l.etapaPreventa || "Sin etapa") === r.name), heading: r.name, suffix: " con ese Estado Preventa" })}
                      className="row-hover w-full text-left group flex items-center gap-3 text-xs rounded-md px-2 -mx-2 py-0.5 cursor-pointer">
                      <span className="lead-name w-[8.5rem] shrink-0 font-medium truncate" title={r.name}>{r.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(r.count / maxEtapa) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-slate-300 tabular-nums">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
            {/* leads por año */}
            <Card title="Leads por año" info={INFO.porAnio} className="flex-1" fill
              right={
                <div className="flex items-center gap-1.5">
                  <select value={cYear} onChange={(e) => setCYear(Number(e.target.value))} aria-label="Año" className="cmmi-select text-[11px] font-medium rounded-lg bg-white/[0.04] border border-white/[0.1] px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500/60">
                    {chartYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={cSeg} onChange={(e) => setCSeg(e.target.value as Seg)} aria-label="Periodo" className="cmmi-select text-[11px] font-medium rounded-lg bg-white/[0.04] border border-white/[0.1] px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500/60">
                    {(Object.keys(SEG_LABEL) as Seg[]).map((k) => <option key={k} value={k}>{SEG_LABEL[k]}</option>)}
                  </select>
                </div>
              }>
              {timelineError ? (
                <p className="text-xs text-rose-500 text-center py-6">{timelineError}</p>
              ) : !timeline ? (
                <div className="flex items-center justify-center gap-2 flex-1 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Cargando historial…</div>
              ) : (
              <>
              <div className="flex items-stretch gap-1.5 flex-1 min-h-[9rem] xl:min-h-0">
                {shownMonths.map((m, i) => {
                  const c = m.assigned.length, w = m.closed.length;
                  const tipPos = i < 2 ? "left-0" : i > shownMonths.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                  const sasShare = stackMonth && c > 0 ? (m.assigned.filter((l) => compKey(l) === "SAS").length / c) * 100 : 100;
                  return (
                    <div key={m.key}
                      className="bar-col relative flex-1 min-w-0 flex flex-col rounded-md px-0.5"
                      onMouseEnter={() => setMHover(m.key)} onMouseLeave={() => setMHover(null)}>
                      {mHover === m.key && (
                        <div className={`chart-tip absolute top-1 z-20 ${tipPos} rounded-lg px-3 py-2 text-[11px] whitespace-nowrap pointer-events-none`}>
                          <p className="font-semibold text-slate-100 capitalize mb-1">{m.full}</p>
                          {([["Asignadas a Preventa", m.assigned, "bg-blue-400"], ["Cerradas (Abierto → Cerrado)", m.closed, "bg-violet-400"]] as const).map(([lbl, arr, color]) => (
                            <div key={lbl} className="mb-0.5">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-400"><i className={`w-2 h-2 rounded-sm ${color}`} />{lbl}</span>
                                <span className="text-slate-100 tabular-nums font-medium">{arr.length}</span>
                              </div>
                              {monthLines(arr).map((ln) => (
                                <div key={ln.label} className="flex items-center justify-between gap-4 pl-3.5 text-slate-400">
                                  <span>{ln.label}</span><span className="tabular-nums text-slate-300">{ln.value}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="h-4 flex justify-center gap-2 text-[11px] font-medium tabular-nums leading-4">
                        {shownMonths.length <= 6 && (<><span className="text-slate-300">{c || ""}</span><span className="text-violet-500">{w || ""}</span></>)}
                      </div>
                      <div className="flex-1 flex items-end gap-0.5 min-h-0">
                        <button type="button" disabled={c === 0}
                          onClick={() => setListModal({ leads: m.assigned, heading: m.full, suffix: " asignados a Preventa ese mes" })}
                          title={`Ver los asignados a Preventa en ${m.full}`}
                          className="flex-1 h-full flex items-end disabled:cursor-default">
                          <div className="w-full rounded-t-md overflow-hidden flex flex-col-reverse"
                            style={{ height: `${(c / maxMonth) * 100}%`, minHeight: c ? 4 : 0 }}>
                            {stackMonth ? (
                              <>
                                <div className="bg-blue-400" style={{ height: `${sasShare}%` }} />
                                <div className="bg-teal-400" style={{ height: `${100 - sasShare}%` }} />
                              </>
                            ) : <div className="bg-blue-400 h-full" />}
                          </div>
                        </button>
                        <button type="button" disabled={w === 0}
                          onClick={() => setListModal({ leads: m.closed, heading: m.full, suffix: " cerrados ese mes (Abierto → Cerrado)" })}
                          title={`Ver los cerrados en ${m.full}`}
                          className="flex-1 h-full flex items-end disabled:cursor-default">
                          <div className="w-full rounded-t-md bg-violet-400" style={{ height: `${(w / maxMonth) * 100}%`, minHeight: w ? 4 : 0 }} />
                        </button>
                      </div>
                      <span className="mt-1 text-center text-[11px] text-slate-400 capitalize truncate">{m.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="shrink-0 flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-white/[0.08] text-[11px] text-slate-400">
                {stackMonth ? (
                  <>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> GROW DATA</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-400" /> GD INTL</span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Asignadas</span>
                )}
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400" /> Cerradas</span>
                <span className="ml-auto tabular-nums text-slate-300">{chartTotals.assigned} asignadas · {chartTotals.closed} cerradas</span>
              </div>
              </>
              )}
            </Card>
            </div>
          </div>

          {/* tiempo de ciclo y agenda de cierres */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Tiempo de ciclo en Preventa" info={INFO.ciclo}
              right={
                <select value={String(cycYear)} onChange={(e) => setCycYear(e.target.value === "ALL" ? "ALL" : Number(e.target.value))} aria-label="Año del tiempo de ciclo"
                  className="cmmi-select text-[11px] font-medium rounded-lg bg-white/[0.04] border border-white/[0.1] px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500/60">
                  <option value="ALL">Todos los años</option>
                  {chartYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              }>
              <PresalesCycleCard
                timeline={timeline} error={timelineError} scope={chartScope} year={cycYear}
                onList={(ls, heading) => setListModal({ leads: ls, heading })}
                onOpenPreventa={(n) => setFichaName(n)}
              />
            </Card>
            <Card title="Agenda de cierres" info={INFO.agenda}>
              <PresalesAgendaCard leads={agendaLeads} daysToClose={daysToClose} fmtCOP={fmtCOP} fmtUSD={fmtUSD} onOpenLead={(l) => setSelected(l)} />
            </Card>
          </div>

          {/* kanban de Estado Preventa */}
          <Card title="Tablero estados preventa" info={INFO.tablero}>
            <PresalesKanbanBoard
              leads={etapaScope} staleDays={STALE_DAYS} daysSince={daysSince} fmtCOP={fmtCOP} fmtUSD={fmtUSD}
              blocked={!!selected || !!listModal}
              onList={(ls, heading) => setListModal({ leads: ls, heading })}
              onOpenLead={(l) => setSelected(l)}
            />
          </Card>
        </>
      )}

      {fichaName && (
        <PresalesPreventaModal
          name={fichaName} roleLabel={({ profesional: "Profesional", lider: "Líder", gerente: "Gerente" } as const)[kindOf(fichaName)]}
          active={!isInactive(fichaName)} leads={leads} timeline={timeline} year={cycYear} limit={CARGA_LIMIT}
          teamOcup={ocupGlobal} teamStale={stats.stale.length / Math.max(1, profRows.length)}
          staleDays={STALE_DAYS} daysSince={daysSince} fmtCOP={fmtCOP} fmtUSD={fmtUSD}
          blocked={!!selected || !!listModal} onClose={() => setFichaName(null)}
          onOpenLead={(l) => setSelected(l)} onList={(ls, heading) => setListModal({ leads: ls, heading })}
        />
      )}
      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
      {showSettings && (
        <PresalesSettingsPanel
          settings={settings} initialSection={settingsSection} onSave={saveSettings} onClose={() => setShowSettings(false)}
          onManagePreventas={canManage ? () => setShowManage(true) : undefined} blocked={showManage}
        />
      )}
      {showOcup && (
        <PresalesOcupacionModal
          rows={tableRows.map((r) => ({ name: r.name, open: r.open, kind: kindOf(r.name) }))}
          leads={abiertosLeads}
          limit={CARGA_LIMIT}
          blocked={!!listModal}
          onClose={() => setShowOcup(false)}
          onList={(ls, heading) => setListModal({ leads: ls, heading })}
          onOpenSettings={() => { setShowOcup(false); setSettingsSection("ocupacion"); setShowSettings(true); }}
        />
      )}
      {listModal && (
        <LeadsListModal
          leads={listModal.leads}
          title="Leads de preventa"
          heading={listModal.heading}
          suffix={listModal.suffix ?? " con Etapa Prev. abierta"}
          showEstadoPreventaChips={listModal.chips}
          onClose={() => setListModal(null)}
        />
      )}
      {cargaExpanded && createPortal(
        <div className="dashboard-shell">
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ backgroundColor: "var(--app-modal-overlay)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setCargaExpanded(false); }}
          >
            <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full max-w-6xl max-h-[88vh] flex flex-col overflow-hidden">
              <div className="app-bar modal-header flex items-center justify-between px-6 h-[60px] shrink-0 border-b border-white/[0.07]">
                <h2 className="font-semibold text-slate-100 uppercase tracking-wide text-sm">Carga por preventa</h2>
                <button onClick={() => setCargaExpanded(false)} title="Cerrar"
                  className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-white/[0.05] bg-black/20 shrink-0">
                <span className="text-xs font-medium text-slate-500">Compañía</span>
                {cargaPills}
              </div>
              <div className="overflow-auto flex-1 px-6 py-4">{renderCargaTable(true)}</div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {showManage && (
        <PresalesManageModal people={people} statuses={statuses} onSave={saveStatuses} onClose={() => setShowManage(false)} />
      )}
    </div>
  );
}
