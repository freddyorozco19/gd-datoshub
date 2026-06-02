import type { NextRequest } from "next/server";

const CMMI_API_URL = process.env.CMMI_API_URL ?? "http://127.0.0.1:8008";

const ALLOWED = new Set(["spc", "rf/train", "rf/predict"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> }
) {
  const { action } = await ctx.params;
  const path = (action ?? []).join("/");

  if (!ALLOWED.has(path)) {
    return Response.json({ error: `Acción no válida: ${path}` }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);

  try {
    const res = await fetch(`${CMMI_API_URL}/comercial/${path}`, {
      method: "POST",
      body: upstream,
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: `No se pudo contactar el servicio de modelos CMMI (${CMMI_API_URL}). ¿Está corriendo? Detalle: ${message}`,
      },
      { status: 502 }
    );
  }
}
