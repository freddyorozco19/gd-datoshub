"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "./ui";

interface ExamRow { score_pct: number; created_at: string }
interface Week { count: number; avg: number | null }

export default function ModulesStrip() {
  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/certifications/history?limit=200", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b: { rows?: ExamRow[] }) => {
        const since = Date.now() - 7 * 86_400_000;
        const recent = (b.rows ?? []).filter((r) => new Date(r.created_at).getTime() >= since);
        setWeek({ count: recent.length, avg: recent.length ? Math.round(recent.reduce((a, r) => a + Number(r.score_pct || 0), 0) / recent.length) : null });
      })
      .catch((e: unknown) => { if (!(e instanceof DOMException)) setFailed(true); });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <Card title="Certificaciones" subtitle="Simulacros de los últimos 7 días"
        action={<Link href="/certificaciones" className="text-[11px] text-slate-400 hover:text-white">Ir →</Link>}>
        {failed ? <p className="text-xs text-slate-500">No se pudo leer el historial.</p> : week === null ? <p className="text-xs text-slate-500">Cargando…</p> : (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white tabular-nums">{week?.count}</span>
            <span className="text-xs text-slate-400">{week?.avg == null ? "sin simulacros esta semana" : `simulacros · promedio ${week.avg}%`}</span>
          </div>
        )}
      </Card>
      <Card title="CMMI" subtitle="Ejecuciones de SPC y Random Forest"
        action={<Link href="/cmmi" className="text-[11px] text-slate-400 hover:text-white">Ir →</Link>}>
        <p className="text-xs text-slate-400">Las ejecuciones se corren desde el módulo CMMI. El resumen aparecerá aquí cuando se registren los resultados.</p>
      </Card>
    </div>
  );
}
