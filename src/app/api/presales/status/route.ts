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

/** POST — marca un preventa como activo/inactivo (solo administrador o líder). */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!canManagePresales(user)) {
    return Response.json({ error: "Acceso restringido a administradores y líderes." }, { status: 403 });
  }

  let body: { name?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200 || typeof body.active !== "boolean") {
    return Response.json({ error: "Parámetros inválidos (name y active)." }, { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/presales_status?on_conflict=name`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      name,
      active: body.active,
      updated_by: user!.email ?? null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[presales-status] upsert falló", res.status, detail);
    if (res.status === 404 || /presales_status/i.test(detail)) {
      return Response.json({ error: "La tabla presales_status aún no está creada en Supabase." }, { status: 503 });
    }
    return Response.json({ error: "No se pudo guardar el cambio." }, { status: 502 });
  }
  const rows = await res.json();
  return Response.json({ status: rows[0] ?? null });
}
