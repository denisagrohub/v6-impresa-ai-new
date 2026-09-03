import { NextResponse } from "next/server";

async function proxyJson(path: string, params: any) {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  const res = await fetch(`${odooUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) {
    return NextResponse.json({ error: data.error.data?.message || data.error.message }, { status: 500 });
  }
  return NextResponse.json(data.result);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return await proxyJson("/api/core-engine/node", body);
  } catch (error: any) {
    return NextResponse.json({ error: "Impossibile raggiungere Odoo", details: error.message }, { status: 502 });
  }
}
