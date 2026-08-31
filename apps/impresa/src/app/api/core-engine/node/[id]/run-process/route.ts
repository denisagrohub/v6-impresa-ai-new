import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  try {
    const body = await req.json();
    const res = await fetch(`${odooUrl}/api/core-engine/node/${params.id}/run-process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: body }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.data?.message || data.error.message }, { status: 500 });
    }
    return NextResponse.json(data.result);
  } catch (error: any) {
    return NextResponse.json({ error: "Impossibile raggiungere Odoo", details: error.message }, { status: 502 });
  }
}
