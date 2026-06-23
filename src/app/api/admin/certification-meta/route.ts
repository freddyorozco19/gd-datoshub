import type { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ESTADOS = new Set(["disponible", "proximamente", "descontinuado"]);

function restFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** GET — lista todos los metadatos editables de exámenes (cualquier usuario logueado). */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const res = await restFetch("/certification_exam_meta?select=*", { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 404 || /certification_exam_meta/i.test(detail)) {
      return Response.json(
        { error: "La tabla de registros no está creada todavía.", needsSetup: true },
        { status: 503 }
      );
    }
    return Response.json({ error: "No se pudo leer los registros." }, { status: 502 });
  }

  const meta = await res.json();
  return Response.json({ meta });
}

/** PATCH — crea o actualiza el metadato (url/estado) de un examen (cualquier usuario logueado). */
export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  let body: { exam_id?: string; url?: string | null; estado?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { exam_id, url = null, estado } = body;
  if (!exam_id || !estado || !ESTADOS.has(estado)) {
    return Response.json({ error: "Parámetros inválidos (exam_id y estado requeridos)." }, { status: 400 });
  }

  const res = await restFetch("/certification_exam_meta", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ exam_id, url, estado, updated_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 404 || /certification_exam_meta/i.test(detail)) {
      return Response.json(
        { error: "La tabla de registros no está creada todavía.", needsSetup: true },
        { status: 503 }
      );
    }
    return Response.json({ error: "No se pudo guardar el registro." }, { status: 502 });
  }

  const rows = await res.json();
  return Response.json({ meta: rows[0] });
}
