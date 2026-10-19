import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { fetchModelFields, DATASET_MODELS, type DatasetModel } from "@/lib/odoo/client";

/** GET — catálogo de campos de un modelo de Odoo (solo administradores). */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }
  const model = (req.nextUrl.searchParams.get("model") ?? "crm.lead") as DatasetModel;
  if (!DATASET_MODELS.includes(model)) return Response.json({ error: "Modelo no permitido." }, { status: 400 });
  try {
    return Response.json({ model, fields: await fetchModelFields(model) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo leer el catálogo de campos." }, { status: 502 });
  }
}
