import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-white/[0.06] text-slate-400",
  info:    "bg-cyan-500/10 text-cyan-400",
  good:    "bg-emerald-500/10 text-emerald-400",
  warn:    "bg-amber-500/10 text-amber-400",
  bad:     "bg-rose-500/10 text-rose-400",
} as const;

/* Etiqueta pequeña redondeada. `tone` elige el color; `className` permite un color propio (ej. el de una etapa). */
export default function Pill({ tone = "neutral", className = "", title, children }: {
  tone?: keyof typeof TONES; className?: string; title?: string; children: ReactNode;
}) {
  return <span title={title} className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${className || TONES[tone]}`}>{children}</span>;
}
