import { getAuthedUser } from "@/lib/auth/roles";
import { fetchPresalesResponse } from "@/lib/odoo/client";

/** GET — inicio (paso a Preventa) y primera acción de la preventa de cada lead, según el historial de Odoo. Requiere sesión. */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });
  try {
    return Response.json(await fetchPresalesResponse());
  } catch (e) {
    console.error("[presales-response]", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer el historial de Odoo." }, { status: 502 });
  }
}
