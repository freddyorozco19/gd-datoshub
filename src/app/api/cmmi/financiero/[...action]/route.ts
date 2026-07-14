import type { NextRequest } from "next/server";

export const maxDuration = 120;

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED_GET    = new Set(["lineas-base", "info"]);
const ALLOWED_POST   = new Set(["predecir"]);
const ALLOWED_UPLOAD = new Set(["cargar"]);

const LOCAL_ONLY_MSG =
  "La ejecución de modelos CMMI de Financiero requiere el microservicio Python " +
  "(pandas · numpy · scipy) que solo está disponible en entorno local o con " +
  "CMMI_API_URL configurado. Para ejecutarlo localmente corre: " +
  "uvicorn main:app --port 8008 en services/cmmi-api/.";

async function proxy(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Response> {
  const res = await fetch(`${CMMI_API_URL}/financiero/${path}`, {
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

function localOnly() {
  return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });
}

function unreachable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return Response.json(
    { error: `No se pudo contactar el microservicio CMMI (${CMMI_API_URL}). ¿Está corriendo? ${msg}` },
    { status: 502 },
  );
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const { action } = await ctx.params;
  const path = (action ?? []).join("/");
  if (!ALLOWED_GET.has(path))
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  if (IS_HOSTED) return localOnly();
  try { return await proxy("GET", path); } catch (e) { return unreachable(e); }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const { action } = await ctx.params;
  const path = (action ?? []).join("/");
  if (IS_HOSTED) return localOnly();

  if (ALLOWED_UPLOAD.has(path)) {
    try {
      const form = await req.formData();
      const res  = await fetch(`${CMMI_API_URL}/financiero/${path}`, { method: "POST", body: form });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
    } catch (e) { return unreachable(e); }
  }

  if (!ALLOWED_POST.has(path))
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Se esperaba JSON" }, { status: 400 });
  }
  try { return await proxy("POST", path, body); } catch (e) { return unreachable(e); }
}
