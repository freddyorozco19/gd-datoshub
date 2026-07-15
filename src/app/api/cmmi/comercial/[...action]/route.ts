import type { NextRequest } from "next/server";

export const maxDuration = 120;

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";
const IS_HOSTED    = !!process.env.VERCEL && !process.env.CMMI_API_URL;

const ALLOWED_GET    = new Set(["rf/status"]);
const ALLOWED_JSON   = new Set(["rf/predict-one"]);
const ALLOWED_UPLOAD = new Set(["spc", "rf/train", "rf/predict"]);

const LOCAL_ONLY_MSG =
  "La ejecución de modelos CMMI (SPC y Random Forest) se realiza con un microservicio " +
  "Python (pandas · scikit-learn · matplotlib) que solo está disponible en entorno local. " +
  "En esta versión desplegada la función está deshabilitada. Para ejecutarla, corre la app " +
  "y el servicio de modelos en tu máquina (uvicorn en el puerto 8008).";

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
    const res  = await fetch(`${CMMI_API_URL}/comercial/${path}`);
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

  if (IS_HOSTED) return Response.json({ error: LOCAL_ONLY_MSG, localOnly: true }, { status: 503 });

  // JSON body (predict-one)
  if (ALLOWED_JSON.has(path)) {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Se esperaba JSON" }, { status: 400 });
    }
    try {
      const res = await fetch(`${CMMI_API_URL}/comercial/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
    } catch (err) { return unreachable(err); }
  }

  // Multipart upload (spc, rf/train, rf/predict)
  if (!ALLOWED_UPLOAD.has(path)) {
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return Response.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
  }
  const upstream = new FormData();
  upstream.append("file", file, file.name);
  try {
    const res  = await fetch(`${CMMI_API_URL}/comercial/${path}`, { method: "POST", body: upstream });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } });
  } catch (err) { return unreachable(err); }
}
