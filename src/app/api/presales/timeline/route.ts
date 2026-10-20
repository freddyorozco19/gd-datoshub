import { getAuthedUser } from "@/lib/auth/roles";
import { fetchPresalesTimeline } from "@/lib/odoo/client";

/** GET — fechas de entrada a Preventa y de cierre de cada lead (historial de Odoo). Requiere sesión. */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });
  try {
    return Response.json(await fetchPresalesTimeline());
  } catch (e) {
    console.error("[presales-timeline]", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer el historial de Odoo." }, { status: 502 });
  }
}
