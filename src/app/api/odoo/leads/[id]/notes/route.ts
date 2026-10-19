import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";
import { fetchLeadNotes } from "@/lib/odoo/client";

/** GET — notas, mensajes, correos y cambios (chatter de Odoo) de una oportunidad. Requiere sesión. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { id } = await ctx.params;
  const leadId = parseInt(id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  try {
    return NextResponse.json({ notes: await fetchLeadNotes(leadId) });
  } catch (err) {
    console.error("[ODOO notes]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudieron leer las notas de este lead." }, { status: 502 });
  }
}
