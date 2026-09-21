"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export const filterOptionLabel = (o: string) => (o === "ALL" ? "TODOS" : o === "true" ? "Activo" : o === "false" ? "Inactivo" : o);

/* dropdown de filtro con buscador (fuera de las vistas para no perder su estado "open" en cada re-render del padre) */
export default function FilterSelect({
  label,
  value,
  onChange,
  options,
  headerAction,
  widthClass = "w-28",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  headerAction?: ReactNode;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 190) });
      setQuery("");
    }
    setOpen((o) => !o);
  }

  function pick(o: string) {
    onChange(o);
    setOpen(false);
  }

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(query.trim());
  const visible = q
    ? options.filter((o) => norm(filterOptionLabel(o)).includes(q) || norm(o).includes(q))
    : options;

  return (
    <div className={`flex flex-col gap-1.5 shrink-0 ${widthClass}`}>
      <div className="flex items-center justify-center gap-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{label}</label>
        {headerAction}
      </div>
      <button
        type="button"
        ref={btnRef}
        onClick={toggle}
        className="text-xs rounded-lg px-2.5 py-2 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors cursor-pointer w-full flex items-center justify-between gap-1"
      >
        <span className="truncate">{filterOptionLabel(value)}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect && createPortal(
        // .dashboard-shell envuelve el panel para que los overrides de tema
        // claro (que requieren ese ancestro) sigan aplicando fuera del árbol
        // normal — el portal lo saca de .dashboard-shell hacia document.body.
        <div className="dashboard-shell">
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}
            className="modal-panel max-h-72 flex flex-col overflow-hidden z-50 rounded-lg border border-white/[0.12] shadow-2xl shadow-black/40"
          >
            <div className="p-1.5 border-b border-white/[0.08] shrink-0">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && visible.length > 0) pick(visible[0]);
                }}
                placeholder="Buscar…"
                className="w-full text-xs rounded-md px-2 py-1.5 bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
              />
            </div>
            <div className="overflow-auto py-1">
              {visible.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => pick(o)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    o === value ? "filter-option-selected" : "filter-option text-slate-300"
                  }`}
                >
                  {filterOptionLabel(o)}
                </button>
              ))}
              {visible.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500">Sin resultados</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
