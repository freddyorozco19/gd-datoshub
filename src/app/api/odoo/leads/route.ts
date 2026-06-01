import { fetchLeads } from "@/lib/odoo/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const leads = await fetchLeads();
    return NextResponse.json({ leads, total: leads.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ODOO]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
