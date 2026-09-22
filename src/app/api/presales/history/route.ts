import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";
import { fetchPreventaHistory, fetchEtapaActualHistory } from "@/lib/odoo/client";

/** GET — últimos cambios de Estado Preventa o Etapa Actual (leídos de mail.tracking.value en Odoo).
 *  ?field=etapaActual usa el Stage real de Odoo (stage_id); por defecto usa Estado Preventa. */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  const leadIdParam = Number(req.nextUrl.searchParams.get("leadId"));
  const leadId = Number.isFinite(leadIdParam) && leadIdParam > 0 ? leadIdParam : undefined;

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const defaultLimit = leadId ? 50 : 15;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : defaultLimit;

  const field = req.nextUrl.searchParams.get("field");
  const fetchHistory = field === "etapaActual" ? fetchEtapaActualHistory : fetchPreventaHistory;

  try {
    const entries = await fetchHistory(limit, leadId);
    return Response.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[presales-history]", message);
    return Response.json({ error: "No se pudo leer el historial de Odoo." }, { status: 502 });
  }
}
