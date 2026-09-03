import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ROLES = new Set(["admin", "user"]);
const AREAS = new Set(["TI", "DATOS", "PREVENTA", "CALIDAD"]);

/** Llama a la API admin de GoTrue con la service-role key (solo server). */
function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Llama a la API de auth de GoTrue (sin prefijo /admin) — usado por /invite. */
function authFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

interface GoTrueUser {
  id: string;
  email?: string;
  app_metadata?: { role?: string; area?: string | null };
  last_sign_in_at?: string | null;
  created_at?: string;
}

/** GET — lista todos los usuarios (solo admin). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  const res = await adminFetch("/users?per_page=200");
  if (!res.ok) {
    return Response.json({ error: "No se pudo obtener la lista de usuarios." }, { status: 502 });
  }
  const data = (await res.json()) as { users?: GoTrueUser[] };
  const users = (data.users ?? []).map((u) => ({
    id:    u.id,
    email: u.email ?? "",
    role:  u.app_metadata?.role === "admin" ? "admin" : "user",
    area:  u.app_metadata?.area && AREAS.has(u.app_metadata.area) ? u.app_metadata.area : null,
    lastSignInAt: u.last_sign_in_at ?? null,
    createdAt:    u.created_at ?? null,
    isSelf: u.id === admin.id,
  }));
  users.sort((a, b) => a.email.localeCompare(b.email));
  return Response.json({ users });
}

/** POST — invita un nuevo usuario por email (Supabase envía el correo). */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { email, role = "user" } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Email inválido." }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return Response.json({ error: "Rol inválido." }, { status: 400 });
  }

  // Supabase envía automáticamente el correo de invitación con link para establecer contraseña.
  // Los links de invite/magiclink usan flujo implícito (tokens en el hash de la URL), que solo
  // el cliente puede leer — por eso se redirige directo a /set-password (página cliente) y NO a
  // /api/auth/callback (ruta de servidor, que solo entiende el flujo PKCE con ?code=).
  const origin = new URL(req.url).origin;
  const redirectTo = `${origin}/set-password`;
  const inviteRes = await authFetch(`/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!inviteRes.ok) {
    const err = await inviteRes.json().catch(() => ({}));
    return Response.json({ error: err.msg || err.message || "No se pudo enviar la invitación." }, { status: 502 });
  }
  const u = (await inviteRes.json()) as GoTrueUser;

  // Si el rol es admin, actualizamos app_metadata
  if (role === "admin") {
    await adminFetch(`/users/${u.id}`, {
      method: "PUT",
      body: JSON.stringify({ app_metadata: { role: "admin" } }),
    });
  }

  return Response.json({
    id:    u.id,
    email: u.email ?? email,
    role,
    invited: true,
  }, { status: 201 });
}

/** PATCH — cambia el rol y/o el área de un usuario (solo admin). */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  let body: { id?: string; role?: string; area?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { id, role, area } = body;
  if (!id || (role === undefined && area === undefined)) {
    return Response.json({ error: "Parámetros inválidos (id y al menos role o area)." }, { status: 400 });
  }
  if (role !== undefined && !ROLES.has(role)) {
    return Response.json({ error: "Rol inválido." }, { status: 400 });
  }
  if (area !== undefined && area !== null && !AREAS.has(area)) {
    return Response.json({ error: "Área inválida." }, { status: 400 });
  }

  // Evita que el admin se quite a sí mismo el rol y se bloquee fuera.
  if (id === admin.id && role !== undefined && role !== "admin") {
    return Response.json({ error: "No puedes quitarte el rol de administrador a ti mismo." }, { status: 409 });
  }

  // El PUT de GoTrue reemplaza app_metadata por completo, así que se fusiona
  // con lo existente (rol/área) para no perder el campo que no se está editando.
  const currentRes = await adminFetch(`/users/${id}`);
  if (!currentRes.ok) {
    return Response.json({ error: "No se pudo cargar el usuario." }, { status: 502 });
  }
  const current = (await currentRes.json()) as GoTrueUser;

  const nextMetadata = {
    ...current.app_metadata,
    ...(role !== undefined ? { role } : {}),
    ...(area !== undefined ? { area } : {}),
  };

  const res = await adminFetch(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ app_metadata: nextMetadata }),
  });
  if (!res.ok) {
    return Response.json({ error: "No se pudo actualizar el usuario." }, { status: 502 });
  }
  const u = (await res.json()) as GoTrueUser;
  return Response.json({
    id: u.id,
    email: u.email ?? "",
    role: u.app_metadata?.role === "admin" ? "admin" : "user",
    area: u.app_metadata?.area && AREAS.has(u.app_metadata.area) ? u.app_metadata.area : null,
  });
}

/** DELETE — elimina un usuario (solo admin). */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Parámetro 'id' requerido." }, { status: 400 });
  }

  // Evita que el admin se elimine a sí mismo y se bloquee fuera.
  if (id === admin.id) {
    return Response.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 409 });
  }

  const res = await adminFetch(`/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    return Response.json({ error: "No se pudo eliminar el usuario." }, { status: 502 });
  }
  return Response.json({ id, deleted: true });
}
