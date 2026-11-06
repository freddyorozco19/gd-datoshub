"use client";

import { useEffect, useRef, type ReactNode, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* Contenedor base de popups: portal + `dashboard-shell` (tema), fondo con clic para cerrar, Esc, rol de diálogo,
   foco atrapado (Tab no sale del popup), foco devuelto al cerrar y scroll de la página bloqueado.
   `blocked` desactiva Esc/clic-fuera cuando hay otro popup encima (por ejemplo la ficha del lead). */
export default function Modal({
  onClose, blocked = false, label, maxWidth = "max-w-4xl", panelClassName = "modal-panel", panelProps, children,
}: {
  onClose: () => void;
  blocked?: boolean;
  label: string;                                  // nombre accesible del diálogo
  maxWidth?: string;                              // clase de ancho máximo (ej. "max-w-5xl")
  panelClassName?: string;
  panelProps?: HTMLAttributes<HTMLDivElement> & { [k: `data-${string}`]: string | undefined };
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // scroll de la página bloqueado mientras haya popup
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // foco: entra al popup y vuelve al elemento previo al cerrar
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = panelRef.current;
    if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    return () => { before?.focus?.(); };
  }, []);

  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const el = panelRef.current; if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); el.focus(); return; }
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !el.contains(active))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked]);

  const { className: extra = "", ...rest } = panelProps ?? {};
  return createPortal(
    <div className="dashboard-shell">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget && !blocked) onClose(); }}
      >
        <div
          ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
          {...rest}
          className={`${panelClassName} ${extra} backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full ${maxWidth} max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden outline-none`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
