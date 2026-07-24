import type { NextRequest } from "next/server";

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED_POST   = new Set(["kickoff", "seguimiento"]);
const ALLOWED_UPLOAD = new Set(["reentrenar"]);
const ALLOWED_GET    = new Set(["info"]);

export const maxDuration = 120;

const LOCAL_ONLY_MSG =
  "La ejecución de modelos CMMI de Proyectos requiere el microservicio Python " +
  "(scikit-learn · numpy · pandas) que solo está disponible en entorno local o con " +
  "CMMI_API_URL configurado. Para ejecutarlo localmente corre: " +
  "uvicorn main:app --port 8008 en services/cmmi-api/.";

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
  if (IS_HOSTED)
    return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });
  try {
    const res = await fetch(`${CMMI_API_URL}/proyectos/${path}`);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) { return unreachable(err); }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const { action } = await ctx.params;
  const path = (action ?? []).join("/");

  if (IS_HOSTED) {
    return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });
  }

  if (ALLOWED_UPLOAD.has(path)) {
    try {
      const form = await req.formData();
      const res  = await fetch(`${CMMI_API_URL}/proyectos/${path}`, { method: "POST", body: form });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
      });
    } catch (err) { return unreachable(err); }
  }

  if (!ALLOWED_POST.has(path)) {
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Se esperaba JSON" }, { status: 400 });
  }

  try {
    const res = await fetch(`${CMMI_API_URL}/proyectos/${path}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const text = await res.text();
    return new Response(text, {
      status:  res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) { return unreachable(err); }
}
