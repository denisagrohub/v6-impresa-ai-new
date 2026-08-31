import { NextResponse } from "next/server";

// Proxy verso l'endpoint JSON-RPC Odoo /api/core-engine/arc/<id>/toggle.
// Le route type='json' di Odoo richiedono la busta JSON-RPC in richiesta e
// la restituiscono in risposta (result/error) -- gestita qui, il frontend
// vede solo il payload utile.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  try {
    const res = await fetch(`${odooUrl}/api/core-engine/arc/${params.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: {} }),
      cache: "no-store",
    });
    const body = await res.json();
    if (body.error) {
      return NextResponse.json({ error: body.error.data?.message || body.error.message }, { status: 500 });
    }
    return NextResponse.json(body.result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Impossibile raggiungere Odoo", details: error.message },
      { status: 502 }
    );
  }
}
