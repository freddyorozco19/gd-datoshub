"use client";

import { useMemo, useState } from "react";
import { Paperclip, Loader2, MessageSquare, StickyNote, Mail, ArrowRight, Settings2 } from "lucide-react";
import type { LeadNote, LeadNoteKind } from "@/lib/odoo/types";
import { personInitials as initials } from "./initials";

/* Pestaña "Notas" del detalle de un lead: el chatter de Odoo (notas, mensajes, correos y cambios) en orden cronológico. */

type Filter = "ALL" | "talk" | "email" | "change";

const KIND_STYLE: Record<LeadNoteKind, { cls: string; icon: typeof StickyNote }> = {
  note:    { cls: "bg-amber-500/10 text-amber-500",   icon: StickyNote },
  message: { cls: "bg-blue-500/10 text-blue-500",     icon: MessageSquare },
  email:   { cls: "bg-violet-500/10 text-violet-500", icon: Mail },
  change:  { cls: "bg-emerald-500/10 text-emerald-500", icon: ArrowRight },
  system:  { cls: "bg-white/[0.06] text-slate-400",   icon: Settings2 },
};
const AVATAR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
const avatarOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];

const toDate = (utc: string) => new Date(utc.replace(" ", "T") + "Z");
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (utc: string) => { const d = toDate(utc); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDay = (utc: string) => toDate(utc).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
const dayKey = (utc: string) => { const d = toDate(utc); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ago = (utc: string) => {
  const days = Math.floor((Date.now() - toDate(utc).getTime()) / 86400000);
  if (days < 1) return "hoy";
  if (days < 31) return `hace ${days} d`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) === 1 ? "" : "es"}`;
  return `hace ${Math.floor(days / 365)} año${Math.floor(days / 365) === 1 ? "" : "s"}`;
};

function NoteBody({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420 || text.split("\n").length > 7;
  return (
    <div className="mt-1.5">
      <p className={`text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed ${long && !open ? "line-clamp-6" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-medium text-blue-500 hover:underline">
          {open ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}

export default function LeadNotesPanel({ notes, loading, error }: { notes: LeadNote[] | null; loading: boolean; error: string | null }) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(() => {
    const all = notes ?? [];
    return {
      ALL: all.length,
      talk: all.filter((n) => n.kind === "note" || n.kind === "message").length,
      email: all.filter((n) => n.kind === "email").length,
      change: all.filter((n) => n.kind === "change" || n.changes.length > 0).length,
    };
  }, [notes]);

  const shown = useMemo(() => (notes ?? []).filter((n) =>
    filter === "ALL" ? true
    : filter === "talk" ? (n.kind === "note" || n.kind === "message")
    : filter === "email" ? n.kind === "email"
    : (n.kind === "change" || n.changes.length > 0)), [notes, filter]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: LeadNote[] }[] = [];
    for (const n of shown) {
      const k = dayKey(n.date);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(n);
      else out.push({ key: k, label: fmtDay(n.date), items: [n] });
    }
    return out;
  }, [shown]);

  if (loading) return <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs"><Loader2 size={13} className="animate-spin" /> Cargando notas…</div>;
  if (error) return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  if (!notes || notes.length === 0) return <p className="text-xs text-slate-400 text-center py-8">Este lead no tiene notas ni mensajes registrados en Odoo</p>;

  const pills: [Filter, string][] = [["ALL", "Todo"], ["talk", "Notas y mensajes"], ["email", "Correos"], ["change", "Cambios"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {pills.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} data-active={filter === id}
            className="pill-option text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap">
            {label} <span className="tabular-nums opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin entradas de este tipo</p>}

      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-center gap-3 mb-2">
            <span className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</span>
            <span className="flex-1 h-px bg-white/[0.08]" />
          </div>
          <ol className="space-y-2.5">
            {g.items.map((n) => {
              const ks = KIND_STYLE[n.kind];
              const Icon = ks.icon;
              return (
                <li key={n.id} className="row-hover rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 flex gap-3">
                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${avatarOf(n.author)}`} aria-hidden>{initials(n.author)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold text-slate-100">{n.author}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ks.cls}`}><Icon size={10} /> {n.kindLabel}</span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtTime(n.date)} · {ago(n.date)}</span>
                      {n.replyTo && <span className="text-[11px] text-slate-500">responde al mensaje #{n.replyTo}</span>}
                    </div>
                    {n.subject && n.kind === "email" && <p className="text-xs font-medium text-slate-200 mt-1">{n.subject}</p>}
                    {n.body && <NoteBody text={n.body} />}
                    {n.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {n.changes.map((c, i) => (
                          <li key={i} className="text-xs text-slate-300 flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-slate-400">{c.from || "—"}</span>
                            <ArrowRight size={10} className="text-slate-500 self-center" />
                            <span className="font-medium text-slate-100">{c.to || "—"}</span>
                            <span className="italic text-slate-400">({c.field})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {n.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {n.attachments.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 py-0.5 rounded-md border border-white/[0.08] max-w-[220px]" title={a.name}>
                            <Paperclip size={10} className="shrink-0" /> <span className="truncate">{a.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
