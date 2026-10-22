import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";
import { fetchLeadTimeline } from "@/lib/odoo/client";

/** GET — recorrido por etapas y estados de una oportunidad, con fechas (historial de Odoo). Requiere sesión. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { id } = await ctx.params;
  const leadId = parseInt(id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  try {
    const timeline = await fetchLeadTimeline(leadId);
    if (!timeline) return NextResponse.json({ error: "Lead no encontrado." }, { status: 404 });
    return NextResponse.json({ timeline });
  } catch (err) {
    console.error("[ODOO timeline]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo leer el recorrido de este lead." }, { status: 502 });
  }
}
