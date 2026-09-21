import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseUserAgent } from "@/lib/auth/ua";
import { roleOf } from "@/lib/auth/roles";
import { isTraceExcluded } from "@/lib/auth/trace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  let body: { email?: string; status?: string; action?: string; path?: string; metadata?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }

  let userId: string | null = null;
  let email: string | null = body.email ?? null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      userId = data.user.id;
      email  = data.user.email ?? email;
      isAdmin = roleOf(data.user) === "admin";
    }
  } catch { /* sin sesión todavía */ }

  const action = body.action ?? "login";

  // No registrar visitas de página del admin
  if (action === "page_view" && isAdmin) {
    return Response.json({ ok: true });
  }

  // Cuentas excluidas de la trazabilidad
  if (isTraceExcluded(email)) {
    return Response.json({ ok: true });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const { browser, os } = parseUserAgent(ua);
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip  = (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim() || null;

  const record: Record<string, unknown> = {
    user_id:    userId,
    email,
    action,
    path:       body.path ?? null,
    metadata:   body.metadata ?? null,
    ip,
    user_agent: ua.slice(0, 500),
    browser,
    os,
    status:     body.status === "error" ? "error" : "success",
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/access_log`, {
      method: "POST",
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer:        "return=minimal",
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      console.error("[log-access] insert falló", res.status, action, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[log-access] error de red al insertar", action, e);
  }

  return Response.json({ ok: true });
}
