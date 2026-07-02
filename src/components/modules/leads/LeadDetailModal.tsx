"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, Paperclip, FileText, FileImage, File } from "lucide-react";
import type { Lead, OdooAttachment } from "@/lib/odoo/types";

const ODOO_BASE = "https://grow-data.odoo.com";

const COP = (v: number) =>
  v ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v) : "—";

const fmtFileSize = (bytes: number): string => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
};

function fileTypeIcon(mimetype: string): { icon: typeof File; colors: string } {
  if (mimetype === "application/pdf")
    return { icon: FileText,  colors: "bg-rose-500/10 text-rose-500" };
  if (mimetype.startsWith("image/"))
    return { icon: FileImage, colors: "bg-violet-500/10 text-violet-500" };
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv")
    return { icon: FileText,  colors: "bg-emerald-500/10 text-emerald-400" };
  if (mimetype.includes("word") || mimetype.includes("document") || mimetype.includes("msword"))
    return { icon: FileText,  colors: "bg-blue-500/10 text-blue-400" };
  return { icon: File, colors: "bg-white/[0.06] text-slate-500" };
}

const WON_STYLE: Record<string, string> = {
  Ganado:        "bg-emerald-500/10 text-emerald-400",
  Perdido:       "bg-rose-500/10 text-rose-400",
  "En progreso": "bg-blue-500/10 text-blue-400",
};

const ETAPA_STYLE: Record<string, string> = {
  "Nuevo":             "bg-white/[0.06] text-slate-400",
  "En proceso":        "bg-sky-500/10 text-sky-400",
  "Propuesta enviada": "bg-violet-500/10 text-violet-400",
  "Negociación":       "bg-amber-500/10 text-amber-400",
  "Ganado":            "bg-emerald-500/10 text-emerald-400",
  "Perdido":           "bg-rose-500/10 text-rose-400",
};

interface Props { lead: Lead; onClose: () => void }

export default function LeadDetailModal({ lead, onClose }: Props) {
  const [attachments,        setAttachments]        = useState<OdooAttachment[] | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!lead.adjuntos) return;
    setLoadingAttachments(true);
    fetch(`/api/odoo/leads/${lead.id}/attachments`)
      .then((r) => r.json())
      .then((d) => setAttachments(d.attachments ?? []))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false));
  }, [lead.id, lead.adjuntos]);

  const odooUrl = `${ODOO_BASE}/web#model=crm.lead&id=${lead.id}&view_type=form`;

  const Field = ({ label, value }: { label: string; value: ReactNode }) => (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-xs text-slate-300">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(7,7,15,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">ID {lead.id}</p>
            <h2 className="font-semibold text-slate-100 text-base leading-snug" title={lead.nombre}>{lead.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {lead.linea && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">{lead.linea}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${WON_STYLE[lead.ganado] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.ganado}</span>
              {lead.etapa && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ETAPA_STYLE[lead.etapa] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.etapa}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lead.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-500"}`}>
                {lead.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a href={odooUrl} target="_blank" rel="noopener noreferrer" title="Ver en ODOO CRM"
              className="p-2 rounded-lg text-slate-400 hover:bg-orange-500/10 hover:text-orange-500 transition-colors">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Cliente & Contacto</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Cliente"          value={lead.cliente} />
              <Field label="Comercial"        value={lead.comercial} />
              <Field label="Correo"           value={lead.correo} />
              <Field label="Teléfono"         value={lead.telefono} />
              <Field label="Equipo de Ventas" value={lead.equipoVentas} />
              <Field label="Preventa"         value={lead.preventa} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Oportunidad</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Tipo de Oportunidad" value={lead.tipoOportunidad} />
              <Field label="Línea"               value={lead.linea} />
              <Field label="Etapa Preventa"      value={lead.etapaPreventa} />
              <Field label="Fabricante"          value={lead.fabricante} />
              <Field label="Tipo Cliente"        value={lead.tipoCliente} />
              <Field label="Tipo Venta"          value={lead.tipoVenta} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Financiero</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Ingresos Esperados" value={lead.ingresosEsperados ? COP(lead.ingresosEsperados) : null} />
              <Field label="Consultoría COP"    value={lead.consultoriaCOP    ? COP(lead.consultoriaCOP)    : null} />
              <Field label="Datos COP"          value={lead.datosCOP          ? COP(lead.datosCOP)          : null} />
              <Field label="TI COP"             value={lead.tiCOP             ? COP(lead.tiCOP)             : null} />
            </div>
          </section>

          {(lead.alcance || lead.objeto) && (
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Alcance & Objeto</h3>
              <div className="space-y-3">
                {lead.alcance && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Alcance</p><p className="text-xs text-slate-200 leading-relaxed">{lead.alcance}</p></div>}
                {lead.objeto  && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objeto</p><p className="text-xs text-slate-200 leading-relaxed">{lead.objeto}</p></div>}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Fechas</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Fecha Creación"        value={lead.fechaCreacion       ? lead.fechaCreacion.substring(0, 10)  : null} />
              <Field label="Cierre Esperado"       value={lead.cierreEsperado      || null} />
              <Field label="Fecha Efectiva Cierre" value={lead.fechaEfectivaCierre || null} />
              <Field label="Fecha Cierre"          value={lead.fechaCierre         ? lead.fechaCierre.substring(0, 10)    : null} />
              <Field label="Última Modificación"   value={lead.ultimaModificacion  || null} />
            </div>
          </section>

          {lead.adjuntos > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05] flex items-center gap-1.5">
                <Paperclip size={10} /> Adjuntos · {lead.adjuntos}
              </h3>
              {loadingAttachments ? (
                <div className="space-y-2">
                  {Array.from({ length: lead.adjuntos }).map((_, i) => (
                    <div key={i} className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : attachments && attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const { icon: Icon, colors } = fileTypeIcon(att.mimetype);
                    return (
                      <a key={att.id} href={`/api/odoo/attachment/${att.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.05] hover:border-blue-500/30 hover:bg-blue-500/[0.04] transition-colors group">
                        <div className={`p-2 rounded-lg shrink-0 ${colors}`}><Icon size={14} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">{att.name}</p>
                          {att.file_size > 0 && <p className="text-[10px] text-slate-400 mt-0.5">{fmtFileSize(att.file_size)}</p>}
                        </div>
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-3">No se pudieron cargar los adjuntos</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
