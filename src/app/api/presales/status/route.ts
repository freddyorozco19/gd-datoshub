import type { NextRequest } from "next/server";
import { getAuthedUser, canManagePresales } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const ROLES = ["profesional", "lider", "gerente"] as const;
type Role = (typeof ROLES)[number];
// la columna role puede no existir todavía (migración 20261018_presales_status_role.sql): se degrada sin romper
const missingRole = (detail: string) => /role/i.test(detail);

/** GET — estado activo/inactivo y tipo de cada preventa + si quien llama puede gestionarlo. */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });

  const canManage = canManagePresales(user);
  let needsRole = false;
  let res = await fetch(
    `${SUPABASE_URL}/rest/v1/presales_status?select=name,active,role,updated_by,updated_at&order=name.asc`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) {
    const detail = await res.text();
    if (missingRole(detail) && res.status !== 404) {
      needsRole = true;
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/presales_status?select=name,active,updated_by,updated_at&order=name.asc`,
        { headers, cache: "no-store" },
      );
    } else {
      if (res.status === 404 || /presales_status/i.test(detail)) {
        return Response.json({ statuses: [], canManage, needsSetup: true, needsRole: false });
      }
      return Response.json({ error: "No se pudo leer el estado de los preventas." }, { status: 502 });
    }
    if (!res.ok) return Response.json({ error: "No se pudo leer el estado de los preventas." }, { status: 502 });
  }
  const rows = (await res.json()) as { name: string; active: boolean; role?: Role }[];
  return Response.json({
    statuses: rows.map((r) => ({ ...r, role: r.role ?? "profesional" })),
    canManage, needsSetup: false, needsRole,
  });
}

/** POST — guarda en lote el estado activo/inactivo de varios preventas (solo administrador o líder). */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!canManagePresales(user)) {
    return Response.json({ error: "Acceso restringido a administradores y líderes." }, { status: 403 });
  }

  let body: { changes?: { name?: string; active?: boolean; role?: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const changes = Array.isArray(body.changes) ? body.changes : [];
  const valid = changes.length > 0 && changes.length <= 500 && changes.every(
    (c) => typeof c.name === "string" && c.name.trim() && c.name.length <= 200 && typeof c.active === "boolean"
      && (c.role === undefined || (ROLES as readonly string[]).includes(c.role)),
  );
  if (!valid) {
    return Response.json({ error: "Parámetros inválidos (changes: [{ name, active, role? }])." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const upsert = (withRole: boolean) => fetch(`${SUPABASE_URL}/rest/v1/presales_status?on_conflict=name`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(
      changes.map((c) => ({
        name: c.name!.trim(), active: c.active, updated_by: user!.email ?? null, updated_at: now,
        ...(withRole ? { role: (c.role as Role | undefined) ?? "profesional" } : {}),
      })),
    ),
  });
  let roleSaved = true;
  let res = await upsert(true);
  if (!res.ok) {
    const first = await res.clone().text();
    if (missingRole(first) && res.status !== 404) { roleSaved = false; res = await upsert(false); }
  }
  if (!res.ok) {
    const detail = await res.text();
    console.error("[presales-status] upsert falló", res.status, detail);
    if (res.status === 404 || /presales_status/i.test(detail)) {
      return Response.json({ error: "La tabla presales_status aún no está creada en Supabase." }, { status: 503 });
    }
    return Response.json({ error: "No se pudo guardar el cambio." }, { status: 502 });
  }
  return Response.json({ statuses: await res.json(), roleSaved });
}
