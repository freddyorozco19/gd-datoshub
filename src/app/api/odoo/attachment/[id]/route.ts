import { fetchAttachmentData } from "@/lib/odoo/client";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const attachmentId = parseInt(id);
    if (isNaN(attachmentId))
      return new Response("ID inválido", { status: 400 });

    const { name, mimetype, datas } = await fetchAttachmentData(attachmentId);
    const buffer = Buffer.from(datas, "base64");

    // PDFs e imágenes se abren en el navegador; el resto se descarga
    const isInline = mimetype === "application/pdf" || mimetype.startsWith("image/");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimetype,
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ODOO attachment file]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
