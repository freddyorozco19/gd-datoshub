import type { ReactNode } from "react";

/* Caja con encabezado (título + dato de apoyo), separador y cuerpo. Con `grow` ocupa el alto sobrante de su columna. */
export default function Panel({ title, aside, grow, bodyClass = "px-3.5 py-3 flex-1 flex flex-col justify-center", children }: {
  title: ReactNode; aside?: ReactNode; grow?: boolean; bodyClass?: string; children: ReactNode;
}) {
  return (
    <section className={`flex flex-col min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] ${grow ? "flex-1" : ""}`}>
      <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-white/[0.07]">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 whitespace-nowrap">{title}</h3>
        {aside != null && <span className="text-[11px] text-slate-400 truncate">{aside}</span>}
      </header>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
