import type { NextRequest } from "next/server";

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED = new Set(["kickoff", "seguimiento"]);

const LOCAL_ONLY_MSG =
  "La ejecución de modelos CMMI de Proyectos requiere el microservicio Python " +
  "(scikit-learn · numpy · pandas) que solo está disponible en entorno local o con " +
  "CMMI_API_URL configurado. Para ejecutarlo localmente corre: " +
  "uvicorn main:app --port 8008 en services/cmmi-api/.";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  const { action } = await ctx.params;
  const path = (action ?? []).join("/");

  if (!ALLOWED.has(path)) {
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  }

  if (IS_HOSTED) {
    return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `No se pudo contactar el microservicio CMMI (${CMMI_API_URL}). ¿Está corriendo? ${msg}` },
      { status: 502 },
    );
  }
}
