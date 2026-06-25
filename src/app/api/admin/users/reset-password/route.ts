import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

/** POST — establece directamente una nueva contraseña para un usuario (solo admin). */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  let body: { id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { id, password } = body;
  if (!id || !password || password.length < 8) {
    return Response.json({ error: "Parámetros inválidos (id requerido, password mínimo 8 caracteres)." }, { status: 400 });
  }

  const res = await adminFetch(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json({ error: err.msg || err.message || "No se pudo cambiar la contraseña." }, { status: 502 });
  }

  return Response.json({ id, changed: true });
}
