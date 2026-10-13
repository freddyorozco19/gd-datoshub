import type { ReactNode } from "react";

export const fmtMoney = (n: number, company: "COP" | "USD" = "COP"): string => {
  const abs = Math.abs(n);
  const body =
    abs >= 1e9 ? `${(n / 1e9).toFixed(1)}B` :
    abs >= 1e6 ? `${Math.round(n / 1e6).toLocaleString("es-CO")}M` :
    abs >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));
  return `${company === "USD" ? "US$" : "$"}${body}`;
};

export const fmtShortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

export function Card({ title, subtitle, action, children, tone, className = "" }: {
  title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; tone?: "warn"; className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-[#0D0D1A] p-5 min-w-0 ${tone === "warn" ? "border-amber-500/30" : "border-white/[0.07]"} ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-white leading-none">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Delta({ now, prev, suffix = "" }: { now: number | null; prev: number | null; suffix?: string }) {
  if (now === null || prev === null || prev === 0) return <span className="text-slate-500">sin comparación</span>;
  const diff = now - prev;
  const pct = suffix ? diff : (diff / prev) * 100;
  const up = diff >= 0;
  return (
    <span className={up ? "text-emerald-400" : "text-rose-400"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(suffix ? 0 : 1)}{suffix || "%"}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-500 text-center py-8">{children}</p>;
}
