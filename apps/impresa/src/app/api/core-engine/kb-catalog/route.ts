import { NextResponse } from "next/server";

// Proxy verso GET /api/core-engine/kb-catalog (Odoo): voci KB "destinate
// ai sei giudici" (kb_type='prompt' nella categoria erpv6_production
// .kb_category_system_prompts), non l'intero catalogo erpv6.kb.
export async function GET() {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  try {
    const res = await fetch(`${odooUrl}/api/core-engine/kb-catalog`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Impossibile raggiungere Odoo", details: error.message },
      { status: 502 }
    );
  }
}
