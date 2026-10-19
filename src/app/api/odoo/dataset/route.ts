import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { fetchDatasetPage, fetchDatasetRecord, fetchDatasetFacet, DATASET_MODELS, type DatasetModel } from "@/lib/odoo/client";

function parseFilters(raw: string | null): { field: string; value: string }[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.field === "string" && typeof x.value === "string")
      .slice(0, 8)
      .map((x) => ({ field: x.field.slice(0, 80), value: x.value.slice(0, 200) }));
  } catch { return []; }
}

/**
 * GET — datos de un modelo de Odoo (solo administradores).
 *  ?model=crm.lead&fields=a,b&offset=0&limit=50&q=texto&sort=campo:asc   → página de registros
 *  ?model=crm.lead&id=123                                                  → todos los campos de un registro
 *  ?model=crm.lead&facet=campo                                             → valores distintos de un campo (para filtros)
 *  Filtros exactos en la página: &filters=[{"field":"campo","value":"valor"}]  (valor "__empty__" = campo vacío)
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const model = (sp.get("model") ?? "crm.lead") as DatasetModel;
  if (!DATASET_MODELS.includes(model)) return Response.json({ error: "Modelo no permitido." }, { status: 400 });

  try {
    const facet = sp.get("facet");
    if (facet) return Response.json({ values: await fetchDatasetFacet(model, facet) });

    const idParam = sp.get("id");
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "ID inválido." }, { status: 400 });
      const record = await fetchDatasetRecord(model, id);
      if (!record) return Response.json({ error: "Registro no encontrado." }, { status: 404 });
      return Response.json({ record });
    }

    const fields = (sp.get("fields") ?? "").split(",").map((f) => f.trim()).filter(Boolean).slice(0, 80);
    const limit  = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));
    const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
    const data = await fetchDatasetPage({ model, fields, offset, limit, q: (sp.get("q") ?? "").slice(0, 100), sort: sp.get("sort") ?? "id:desc",
      filters: parseFilters(sp.get("filters")) });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo leer el dataset." }, { status: 502 });
  }
}
