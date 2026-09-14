import type { NextRequest } from "next/server";
import { getAuthedUser, roleOf } from "@/lib/auth/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sb(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer:        "return=representation",
      ...(init?.headers ?? {}),
    },
  });
}

/** GET — history for the current user (admin gets all). */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });

  const isAdmin = roleOf(user) === "admin";
  const { searchParams } = new URL(req.url);
  const limitParam = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offsetParam = parseInt(searchParams.get("offset") ?? "0");

  let path = `/exam_history?select=*&order=created_at.desc&limit=${limitParam}&offset=${offsetParam}`;
  if (!isAdmin) path += `&user_id=eq.${user.id}`;

  const res = await sb(path, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || /exam_history/i.test(txt)) {
      return Response.json({ error: "La tabla exam_history no existe.", needsSetup: true }, { status: 503 });
    }
    return Response.json({ error: "No se pudo leer el historial." }, { status: 502 });
  }

  const rows = await res.json();
  return Response.json({ rows, isAdmin });
}

/** POST — save a completed exam session. */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });

  let body: {
    provider_id: string; provider_name: string
    exam_id: string; exam_code: string; exam_name: string
    score_pct: number; correct: number; wrong: number; skipped: number; total: number
    elapsed_sec: number
    config: Record<string, unknown>
  };
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const row = {
    user_id:      user.id,
    user_email:   user.email ?? "",
    provider_id:  body.provider_id,
    provider_name: body.provider_name,
    exam_id:      body.exam_id,
    exam_code:    body.exam_code,
    exam_name:    body.exam_name,
    score_pct:    body.score_pct,
    correct:      body.correct,
    wrong:        body.wrong,
    skipped:      body.skipped,
    total:        body.total,
    elapsed_sec:  body.elapsed_sec,
    config:       body.config,
    created_at:   new Date().toISOString(),
  };

  const res = await sb("/exam_history", { method: "POST", body: JSON.stringify(row) });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || /exam_history/i.test(txt)) {
      return Response.json({ error: "La tabla exam_history no existe.", needsSetup: true }, { status: 503 });
    }
    return Response.json({ error: "No se pudo guardar el historial." }, { status: 502 });
  }

  const rows = await res.json();
  return Response.json({ row: rows[0] });
}
