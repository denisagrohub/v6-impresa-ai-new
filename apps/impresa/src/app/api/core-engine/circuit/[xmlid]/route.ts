import { NextResponse } from "next/server";

// Proxy verso il controller REST di erpv6_core_engine (Odoo). Server-side:
// evita CORS e non espone ODOO_URL al browser. auth='public'+sudo() lato
// Odoo per questo endpoint pilota -- vedi nota nel controller Python.
export async function GET(_req: Request, { params }: { params: { xmlid: string } }) {
  const odooUrl = process.env.ODOO_URL || "http://localhost:8069";
  try {
    const res = await fetch(`${odooUrl}/api/core-engine/circuit/${params.xmlid}`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Impossibile raggiungere Odoo", details: error.message },
      { status: 502 }
    );
  }
}
