import { NextResponse } from "next/server";

export async function GET() {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  try {
    const res = await fetch(`${odooUrl}/api/core-engine/cron-triggers`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: "Impossibile raggiungere Odoo", details: error.message }, { status: 502 });
  }
}
