import type { NextRequest } from "next/server";

export const maxDuration = 300; // reentrenar 4 modelos puede tomar ~2-3 min

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED_GET    = new Set(["info", "lineas-base"]);
const ALLOWED_JSON   = new Set(["kickoff", "seguimiento"]);
const ALLOWED_UPLOAD = new Set(["reentrenar"]);

const LOCAL_ONLY_MSG =
  "La ejecución de modelos CMMI de Proyectos requiere el microservicio Python " +
  "(scikit-learn · numpy · pandas) que solo está disponible en entorno local o con " +
  "CMMI_API_URL configurado. Para ejecutarlo localmente corre: " +
  "uvicorn main:app --port 8008 en services/cmmi-api/.";

const unreachable = (err: unknown) =>
  Response.json(
    { error: `No se pudo contactar el microservicio CMMI (${CMMI_API_URL}). ¿Está corriendo? ${err instanceof Error ? err.message : String(err)}` },
    { status: 502 },
  );

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const path = ((await ctx.params).action ?? []).join("/");
  if (!ALLOWED_GET.has(path)) return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  if (IS_HOSTED) return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });
  try {
    const res  = await fetch(`${CMMI_API_URL}/proyectos/${path}`);
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
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

  // Reentrenamiento — multipart
  if (ALLOWED_UPLOAD.has(path)) {
    try {
      const form = await req.formData();
      const res  = await fetch(`${CMMI_API_URL}/proyectos/${path}`, { method: "POST", body: form });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
    } catch (err) { return unreachable(err); }
  }

  if (!ALLOWED_JSON.has(path)) {
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
