import { NextResponse } from "next/server";

// Proxy verso /api/core-engine/run-six-judges (Odoo, JSON-RPC). Sincrono e
// LENTO (round reali con chiamate AI vere, puo' richiedere alcuni minuti) --
// il chiamante deve gestire un'attesa lunga, vedi nota nel controller Python.
export async function POST(req: Request) {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  const { kb_id } = await req.json();
  try {
    const res = await fetch(`${odooUrl}/api/core-engine/run-six-judges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { kb_id } }),
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
