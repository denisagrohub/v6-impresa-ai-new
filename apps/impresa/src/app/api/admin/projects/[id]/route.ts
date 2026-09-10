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

const CATEGORY_LABELS: Record<string, string> = {
  nda: 'NDA', proposal: 'Proposta', sal: 'SAL', contract: 'Contratto',
  business_plan: 'Business Plan', final: 'Documento Finale', client_upload: 'Caricato dal Cliente',
  other: 'Altro', brand_logo: 'Logo Brand', brand_asset: 'Altro Asset Brand',
  kb_source: 'Sorgente KB', kb_case_study: 'Caso Studio', agent_knowledge: 'Conoscenza Agente',
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
      [['id', '=', id]], [
        'id', 'name', 'lead_id', 'phase_id', 'create_date',
        'interview_score', 'interview_package_hint', 'interview_budget',
        'interview_tempistiche', 'interview_tipo_progetto', 'interview_destinatario',
        'interview_fatturato', 'document_ids',
      ],
    ]);
    if (!orders || !orders.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const order = orders[0];
    const leadId = Array.isArray(order.lead_id) ? order.lead_id[0] : null;
    const documentIds: number[] = order.document_ids || [];

    const [leads, kairosRows, events, documents] = await Promise.all([
      leadId
        ? odoo.execute('crm.lead', 'search_read', [[['id', '=', leadId]], ['partner_name', 'contact_name', 'name', 'user_id', 'email_from']])
        : Promise.resolve([]),
      odoo.execute('erpv6.kairos.matrix', 'search_read', [
        [['res_model', '=', 'erpv6.production.order'], ['res_id', '=', id]],
        ['quadrante', 'prontezza_totale', 'prontezza_level', 'impatto_level', 'assessment_date'], 0, 1, 'id desc',
      ]),
      odoo.execute('erpv6.production.event', 'search_read', [
        [['order_id', '=', id]], ['event_type', 'description', 'create_date'], 0, 30, 'create_date desc',
      ]),
      documentIds.length
        ? odoo.execute('erpv6.library.document', 'search_read', [
            [['id', 'in', documentIds]], ['id', 'name', 'category', 'file_name', 'is_final_client_facing', 'blockchain_status', 'create_date'],
          ])
        : Promise.resolve([]),
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
        emailDestinatario: lead?.email_from || null,
        kairos: kairos ? {
          score: kairos.prontezza_totale,
          prontezzaLabel: PRONTEZZA_LABEL[kairos.prontezza_level] || kairos.prontezza_level,
          impattoLabel: kairos.impatto_level === 'alto' ? 'Alto' : 'Basso',
          quadrante: QUADRANTE_MAP[kairos.quadrante] || kairos.quadrante,
        } : null,
      },
      intervista: {
        score: order.interview_score || null,
        pacchetto: order.interview_package_hint || null,
        budget: order.interview_budget || null,
        tempistiche: order.interview_tempistiche || null,
        tipoProgetto: order.interview_tipo_progetto || null,
        destinatario: order.interview_destinatario || null,
        fatturato: order.interview_fatturato || null,
      },
      documenti: (documents || []).map((d: any) => ({
        id: d.id,
        nome: d.name,
        categoria: CATEGORY_LABELS[d.category] || d.category,
        fileName: d.file_name || null,
        finale: d.is_final_client_facing,
        blockchainStatus: d.blockchain_status || null,
        data: d.create_date,
      })),
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
