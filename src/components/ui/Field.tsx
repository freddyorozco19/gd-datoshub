import type { ReactNode } from "react";

/* Dato de una ficha: etiqueta en mayúsculas + valor (— si está vacío). */
export default function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-[13px] text-slate-300 break-words">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  );
}
