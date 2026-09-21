import type { NextRequest } from "next/server";
import { getAuthedUser, canManagePresales } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

/** GET — estado activo/inactivo de cada preventa + si quien llama puede gestionarlo. */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });

  const canManage = canManagePresales(user);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/presales_status?select=name,active,updated_by,updated_at&order=name.asc`,
    { headers, cache: "no-store" },
  );

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 404 || /presales_status/i.test(detail)) {
      return Response.json({ statuses: [], canManage, needsSetup: true });
    }
    return Response.json({ error: "No se pudo leer el estado de los preventas." }, { status: 502 });
  }
  return Response.json({ statuses: await res.json(), canManage, needsSetup: false });
}

/** POST — guarda en lote el estado activo/inactivo de varios preventas (solo administrador o líder). */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!canManagePresales(user)) {
    return Response.json({ error: "Acceso restringido a administradores y líderes." }, { status: 403 });
  }

  let body: { changes?: { name?: string; active?: boolean }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const changes = Array.isArray(body.changes) ? body.changes : [];
  const valid = changes.length > 0 && changes.length <= 500 && changes.every(
    (c) => typeof c.name === "string" && c.name.trim() && c.name.length <= 200 && typeof c.active === "boolean",
  );
  if (!valid) {
    return Response.json({ error: "Parámetros inválidos (changes: [{ name, active }])." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/presales_status?on_conflict=name`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(
      changes.map((c) => ({ name: c.name!.trim(), active: c.active, updated_by: user!.email ?? null, updated_at: now })),
    ),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[presales-status] upsert falló", res.status, detail);
    if (res.status === 404 || /presales_status/i.test(detail)) {
      return Response.json({ error: "La tabla presales_status aún no está creada en Supabase." }, { status: 503 });
    }
    return Response.json({ error: "No se pudo guardar el cambio." }, { status: 502 });
  }
  return Response.json({ statuses: await res.json() });
}
