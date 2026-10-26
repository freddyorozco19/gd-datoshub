"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ArrowLeft, Clock, Gauge, UserCheck, UserCog, Info, Timer } from "lucide-react";

/* Configuración de la vista Presales — panel lateral estilo Azure ("blade"):
   lista de opciones → al elegir una se abre su detalle con botón de volver, y los cambios
   se aplican con Guardar. Los valores viven en el navegador (localStorage), ver PresalesView. */

export type PresalesSettings = {
  staleDays: number;     // días sin modificaciones para considerar un lead estancado
  maxOcupacion: number;  // máximo de leads abiertos por preventa (100 % de ocupación)
  onlyActive: boolean;   // ocultar preventas inactivos en la tabla de carga y en el filtro Preventa
  slaDays: number;       // meta de tiempo de respuesta de preventa (días hasta la primera acción)
};

export const DEFAULT_PRESALES_SETTINGS: PresalesSettings = { staleDays: 14, maxOcupacion: 10, onlyActive: true, slaDays: 2 };

export type SectionId = "estancados" | "ocupacion" | "preventas" | "respuesta";

export default function PresalesSettingsPanel({
  settings, onSave, onClose, initialSection, onManagePreventas, blocked,
}: {
  settings: PresalesSettings; onSave: (s: PresalesSettings) => void; onClose: () => void; initialSection?: SectionId;
  onManagePreventas?: () => void;   // abre Gestionar preventas (solo para quien puede gestionarlos)
  blocked?: boolean;                // hay otro popup encima: no cerrar con Esc
}) {
  const [draft, setDraft] = useState<PresalesSettings>(settings);
  const [section, setSection] = useState<SectionId | null>(initialSection ?? null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (section) setSection(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [section, onClose, blocked]);

  const dirty = draft.staleDays !== settings.staleDays || draft.maxOcupacion !== settings.maxOcupacion || draft.onlyActive !== settings.onlyActive || draft.slaDays !== settings.slaDays;
  const valid = Number.isInteger(draft.staleDays) && draft.staleDays >= 1 && draft.staleDays <= 365
    && Number.isInteger(draft.maxOcupacion) && draft.maxOcupacion >= 1 && draft.maxOcupacion <= 100
    && Number.isInteger(draft.slaDays) && draft.slaDays >= 1 && draft.slaDays <= 60;

  const sections: { id: SectionId; icon: typeof Clock; title: string; desc: string; value: string }[] = [
    { id: "estancados", icon: Clock,     title: "Leads estancados",       desc: "Tiempo sin modificaciones para considerar un lead estancado.", value: `${draft.staleDays} días` },
    { id: "ocupacion",  icon: Gauge,     title: "Ocupación máxima",       desc: "Máximo de leads abiertos por preventa al mismo tiempo (100 %).", value: `${draft.maxOcupacion} leads` },
    { id: "respuesta",  icon: Timer,     title: "Meta de respuesta",      desc: "Días máximos entre que un lead pasa a Preventa y la preventa actúa.", value: `${draft.slaDays} ${draft.slaDays === 1 ? "día" : "días"}` },
    { id: "preventas",  icon: UserCheck, title: "Preventas inactivos",    desc: "Mostrar u ocultar a los preventas inactivos en la tabla y los filtros.", value: draft.onlyActive ? "Ocultos" : "Visibles" },
  ];
  const current = sections.find((s) => s.id === section);

  const numInput = (key: "staleDays" | "maxOcupacion" | "slaDays", min: number, max: number, unit: string) => (
    <div className="flex items-center gap-3">
      <input
        type="number" inputMode="numeric" min={min} max={max} step={1}
        value={Number.isNaN(draft[key]) ? "" : draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value === "" ? NaN : Math.floor(Number(e.target.value)) }))}
        className="w-28 rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-sm text-slate-200 tabular-nums focus:outline-none focus:border-blue-500/60"
      />
      <span className="text-sm text-slate-400">{unit}</span>
    </div>
  );

  return createPortal(
    <div className="dashboard-shell">
      <div
        className="fixed inset-0 z-50 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <aside
          role="dialog" aria-label="Configuración de Presales"
          className="modal-panel backdrop-blur-2xl absolute right-0 top-0 h-full w-full max-w-[440px] shadow-2xl shadow-black/60 border-l border-white/[0.14] flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: mounted ? "translateX(0)" : "translateX(100%)" }}
        >
          <div className="app-bar modal-header flex items-center justify-between px-5 h-[60px] shrink-0 border-b border-white/[0.07]">
            <div className="flex items-center gap-2 min-w-0">
              {section && (
                <button type="button" onClick={() => setSection(null)} title="Volver" aria-label="Volver" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/[0.12] transition-colors">
                  <ArrowLeft size={16} />
                </button>
              )}
              <h2 className="font-semibold text-slate-100 text-sm uppercase tracking-wide truncate">{current ? current.title : "Configuración"}</h2>
            </div>
            <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {!current ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500 mb-3">Ajusta los criterios con los que se calculan las métricas de Presales.</p>
                {sections.map(({ id, icon: Icon, title, desc, value }) => (
                  <button key={id} type="button" onClick={() => setSection(id)}
                    className="row-hover w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 cursor-pointer">
                    <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500"><Icon size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-200">{title}</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">{desc}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400 tabular-nums">{value}</span>
                    <ChevronRight size={15} className="shrink-0 text-slate-500" />
                  </button>
                ))}
                {onManagePreventas && (
                  <button type="button" onClick={onManagePreventas}
                    className="row-hover w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 cursor-pointer">
                    <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500"><UserCog size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-200">Gestionar preventas</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Define quién sigue activo y de qué tipo es: Profesional, Líder o Gerente.</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-slate-500" />
                  </button>
                )}
              </div>
            ) : section === "estancados" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Un lead abierto se considera <span className="font-medium text-slate-200">estancado</span> cuando lleva más de este tiempo sin modificaciones en Odoo.</p>
                {numInput("staleDays", 1, 365, "días sin cambios")}
                <p className="text-[11px] text-slate-500">Afecta la card Estancados, la columna Estancados de Carga por preventa y la cola de gestión. Valor por defecto: {DEFAULT_PRESALES_SETTINGS.staleDays} días.</p>
              </div>
            ) : section === "respuesta" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Tiempo que debería pasar entre que un lead <span className="font-medium text-slate-200">pasa a la etapa Preventa</span> y la preventa hace su primera acción.</p>
                {numInput("slaDays", 1, 60, "días")}
                <p className="text-[11px] text-slate-500">Se usa como meta en la card Tiempo de respuesta de preventa: las barras por encima de la meta se pintan en ámbar y, al doble, en rojo. Valor por defecto: {DEFAULT_PRESALES_SETTINGS.slaDays} días.</p>
              </div>
            ) : section === "ocupacion" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Cantidad de leads abiertos que equivale al <span className="font-medium text-slate-200">100 % de ocupación</span> de un preventa.</p>
                {numInput("maxOcupacion", 1, 100, "leads abiertos")}
                <p className="text-[11px] text-slate-500">La ocupación global solo cuenta a los preventas de tipo Profesional. Se usa en la columna Ocupación de Carga por preventa: con {Number.isFinite(draft.maxOcupacion) && draft.maxOcupacion > 0 ? draft.maxOcupacion : "—"} leads abiertos, un preventa está al 100 %. Valor por defecto: {DEFAULT_PRESALES_SETTINGS.maxOcupacion}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Ocultar a los preventas marcados como <span className="font-medium text-slate-200">inactivos</span> en la tabla Carga por preventa y en el filtro Preventa.</p>
                <div className="flex gap-1.5">
                  {([[true, "Ocultar inactivos"], [false, "Mostrar todos"]] as const).map(([v, label]) => (
                    <button key={label} type="button" onClick={() => setDraft((d) => ({ ...d, onlyActive: v }))} data-active={draft.onlyActive === v}
                      className="pill-option text-xs font-semibold px-3 py-2 rounded-lg border whitespace-nowrap">{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="shrink-0 flex items-start gap-1.5 px-5 py-2.5 text-[11px] leading-snug text-slate-500 border-t border-white/[0.08]">
            <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
            <span>Estos ajustes se guardan <b className="font-semibold text-slate-400">solo en este navegador</b>: no cambian lo que ven los demás. Los roles de Gestionar preventas sí son compartidos.</span>
          </p>
          <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-white/[0.08]">
            <button type="button" onClick={() => setDraft({ ...DEFAULT_PRESALES_SETTINGS })}
              className="pill-option text-xs font-medium px-3 py-2 rounded-lg border">Restablecer</button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="pill-option text-xs font-medium px-3 py-2 rounded-lg border">Cancelar</button>
              <button type="button" disabled={!dirty || !valid} onClick={() => { onSave(draft); onClose(); }}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-blue-600">
                Guardar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
