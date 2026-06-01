import { fetchLeadAttachments } from "@/lib/odoo/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const attachments = await fetchLeadAttachments(leadId);
    return NextResponse.json({ attachments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ODOO attachments]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
