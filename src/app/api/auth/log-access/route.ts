import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseUserAgent } from "@/lib/auth/ua";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Registra un evento de acceso (inicio de sesión) en public.access_log.
 * Best-effort: nunca debe bloquear el login si algo falla.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; status?: string } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }

  // Atribuir al usuario autenticado si la sesión ya está activa.
  let userId: string | null = null;
  let email: string | null = body.email ?? null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      userId = data.user.id;
      email = data.user.email ?? email;
    }
  } catch { /* sin sesión todavía */ }

  const ua = req.headers.get("user-agent") ?? "";
  const { browser, os } = parseUserAgent(ua);
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim() || null;

  const record = {
    user_id: userId,
    email,
    action: "login",
    ip,
    user_agent: ua.slice(0, 500),
    browser,
    os,
    status: body.status === "error" ? "error" : "success",
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/access_log`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
    });
  } catch { /* best-effort */ }

  return Response.json({ ok: true });
}
