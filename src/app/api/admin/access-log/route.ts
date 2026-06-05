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
