import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";
import { fetchLeadFabricantes } from "@/lib/odoo/client";

/** GET — fabricantes de las oportunidades (x_fabricantes de Odoo). Con ?lead=ID devuelve solo los de ese lead. Requiere sesión. */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    const byLead = await fetchLeadFabricantes();
    const lead = req.nextUrl.searchParams.get("lead");
    if (lead) return NextResponse.json({ fabricantes: byLead[String(parseInt(lead, 10))] ?? [] });
    return NextResponse.json({ byLead });
  } catch (err) {
    console.error("[ODOO fabricantes]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudieron leer los fabricantes de Odoo." }, { status: 502 });
  }
}
