import type { NextRequest } from "next/server";

export const maxDuration = 120;

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED_GET    = new Set(["lineas-base", "info"]);
const ALLOWED_POST   = new Set(["predecir"]);
const ALLOWED_UPLOAD = new Set(["cargar", "lineas-base-excel"]);

const LOCAL_ONLY_MSG =
  "Los modelos de Gobierno de Datos requieren el microservicio Python. " +
  "Córrelo localmente: uvicorn main:app --port 8008 en services/cmmi-api/.";

async function proxy(method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${CMMI_API_URL}/datos/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

const localOnly = () =>
  Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });

const unreachable = (err: unknown) =>
  Response.json(
    { error: `No se pudo contactar el microservicio CMMI (${CMMI_API_URL}). ${err instanceof Error ? err.message : String(err)}` },
    { status: 502 },
  );

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const path = ((await ctx.params).action ?? []).join("/");
  if (!ALLOWED_GET.has(path)) return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  if (IS_HOSTED) return localOnly();
  try { return await proxy("GET", path); } catch (e) { return unreachable(e); }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const path = ((await ctx.params).action ?? []).join("/");
  if (IS_HOSTED) return localOnly();

  // Carga de archivo (multipart)
  if (ALLOWED_UPLOAD.has(path)) {
    try {
      const form = await req.formData();
      const res  = await fetch(`${CMMI_API_URL}/datos/${path}`, { method: "POST", body: form });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
    } catch (e) { return unreachable(e); }
  }

  if (!ALLOWED_POST.has(path)) return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Se esperaba JSON" }, { status: 400 }); }
  try { return await proxy("POST", path, body); } catch (e) { return unreachable(e); }
}
