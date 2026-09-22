import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";
import { fetchPreventaHistory } from "@/lib/odoo/client";

/** GET — últimos cambios de Estado Preventa (leídos de mail.tracking.value en Odoo). */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 15;

  try {
    const entries = await fetchPreventaHistory(limit);
    return Response.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[presales-history]", message);
    return Response.json({ error: "No se pudo leer el historial de Odoo." }, { status: 502 });
  }
}
