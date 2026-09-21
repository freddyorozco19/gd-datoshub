import { requireAdmin } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** GET — lista los eventos de acceso (solo admin). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/access_log?select=*&order=created_at.desc&limit=300`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    // Caso típico: la tabla access_log aún no existe.
    const detail = await res.text();
    if (res.status === 404 || /access_log/i.test(detail)) {
      return Response.json(
        { error: "La tabla de trazabilidad no está creada todavía.", needsSetup: true },
        { status: 503 }
      );
    }
    return Response.json({ error: "No se pudo leer la trazabilidad." }, { status: 502 });
  }

  const events = await res.json();
  return Response.json({ events });
}

/** POST — diagnóstico: intenta insertar un evento de prueba por acción y devuelve la respuesta de Supabase. */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });
  }

  const results: { action: string; ok: boolean; status: number; detail: string }[] = [];
  for (const action of ["login", "page_view", "exam_finish"]) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/access_log`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: admin.id,
          email: admin.email ?? null,
          action,
          path: "/diagnostico",
          metadata: { diagnostic: true },
          status: "success",
        }),
      });
      results.push({ action, ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 400) });
    } catch (e) {
      results.push({ action, ok: false, status: 0, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ results });
}
