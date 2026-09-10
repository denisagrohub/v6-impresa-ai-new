import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

const QUADRANTE_MAP: Record<string, string> = {
  kairos_autentico: 'KAIROS_AUTENTICO',
  quick_win: 'QUICK_WIN',
  prepara_condizioni: 'PREPARA',
  parcheggio: 'PARCHEGGIO',
};
const PRONTEZZA_LABEL: Record<string, string> = { bassa: 'Bassa', media: 'Media', alta: 'Alta' };

const EVENT_TYPE_LABELS: Record<string, string> = {
  interazione_consulente: '💬 Interazione consulente',
  cron_automatico: '⚙️ Cron automatico',
  documento_generato: '📄 Documento generato',
  risorsa_assegnata: '👤 Risorsa assegnata',
};

// 10/09/2026 (Denis: "allora la parte che abbiamo la colleghiamo") -
// dettaglio reale del progetto, in sostituzione del mockup che c'era
// prima (sei_aree/livello/settore/deliverable/richieste sconto: nessuno
// di questi ha un campo reale corrispondente, verificato prima di
// scrivere questa rotta - vedi commento in /admin/projects/[id]/page.tsx).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const orders = await odoo.execute('erpv6.production.order', 'search_read', [
      [['id', '=', id]], ['id', 'name', 'lead_id', 'phase_id', 'create_date'],
    ]);
    if (!orders || !orders.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const order = orders[0];
    const leadId = Array.isArray(order.lead_id) ? order.lead_id[0] : null;

    const [leads, kairosRows, events] = await Promise.all([
      leadId
        ? odoo.execute('crm.lead', 'search_read', [[['id', '=', leadId]], ['partner_name', 'contact_name', 'name', 'user_id']])
        : Promise.resolve([]),
      odoo.execute('erpv6.kairos.matrix', 'search_read', [
        [['res_model', '=', 'erpv6.production.order'], ['res_id', '=', id]],
        ['quadrante', 'prontezza_totale', 'prontezza_level', 'impatto_level', 'assessment_date'], 0, 1, 'id desc',
      ]),
      odoo.execute('erpv6.production.event', 'search_read', [
        [['order_id', '=', id]], ['event_type', 'description', 'create_date'], 0, 30, 'create_date desc',
      ]),
    ]);

    const lead = leads && leads[0];
    const kairos = kairosRows && kairosRows[0];

    return NextResponse.json({
      success: true,
      project: {
        id: order.id,
        nome: order.name || '',
        cliente: lead?.partner_name || lead?.contact_name || lead?.name || '—',
        fase: Array.isArray(order.phase_id) ? order.phase_id[1] : 'Senza fase',
        consulente: Array.isArray(lead?.user_id) ? lead.user_id[1] : 'Non assegnato',
        dataInizio: order.create_date || null,
        kairos: kairos ? {
          score: kairos.prontezza_totale,
          prontezzaLabel: PRONTEZZA_LABEL[kairos.prontezza_level] || kairos.prontezza_level,
          impattoLabel: kairos.impatto_level === 'alto' ? 'Alto' : 'Basso',
          quadrante: QUADRANTE_MAP[kairos.quadrante] || kairos.quadrante,
        } : null,
      },
      interazioni: (events || []).map((e: any) => ({
        tipo: EVENT_TYPE_LABELS[e.event_type] || e.event_type,
        descrizione: e.description || '',
        data: e.create_date,
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/projects/[id]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
