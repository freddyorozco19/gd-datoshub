"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead } from "@/lib/odoo/types";

interface State { leads: Lead[]; loading: boolean; error: string | null; updatedAt: Date | null }

export function useDashboardData() {
  const [state, setState] = useState<State>({ leads: [], loading: true, error: null, updatedAt: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/odoo/leads", { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error ?? `Error ${r.status} al consultar ODOO`);
        return Array.isArray(body) ? body : (body?.leads ?? []);
      })
      .then((leads: Lead[]) => setState({ leads, loading: false, error: null, updatedAt: new Date() }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "No se pudieron cargar los datos" }));
      });
    return () => ctrl.abort();
  }, [tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);
  return { ...state, reload };
}
