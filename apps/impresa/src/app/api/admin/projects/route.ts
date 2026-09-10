import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "la pagina progetti cosa mostra?"): questa rotta non
// esisteva affatto - /admin/projects/page.tsx la chiamava, otteneva un 404,
// e restava con una lista vuota (il fallback a dati finti nel codice si
// attiva solo su un errore di rete, mai su un 404, quindi non scattava
// nemmeno quello). Dati reali da erpv6.production.order (27 produzioni
// reali oggi, incluse alcune di test/verifica lasciate in giro dalle
// sessioni precedenti - NON filtrate qui: non esiste un campo reale che
// distingua "test" da "vero", inventare un filtro per nome sarebbe
// indovinare, non verificare).
//
// "livello" e "settore" del vecchio mockup non hanno NESSUN campo reale
// corrispondente in Odoo - rimossi qui (e lato frontend) invece di
// fabbricare un valore. "stato" mostra la fase reale (erpv6.production.phase),
// non il falso enum a 4 stati del mockup, che non corrisponde a nessuna
// logica reale del motore fasi. Kairós: prontezza_totale/quadrante da
// erpv6.kairos.matrix (motore gia' attivo, stesso usato altrove nel
// progetto), non un punteggio inventato - assente se nessuna valutazione
// e' mai stata fatta per quell'ordine.
const QUADRANTE_MAP: Record<string, string> = {
  kairos_autentico: 'KAIROS_AUTENTICO',
  quick_win: 'QUICK_WIN',
  prepara_condizioni: 'PREPARA',
  parcheggio: 'PARCHEGGIO',
};

export async function GET() {
  try {
    await odoo.connect();

    const orders = await odoo.execute('erpv6.production.order', 'search_read', [
      [], ['id', 'name', 'lead_id', 'phase_id', 'create_date', 'write_date'], 0, 200, 'id desc',
    ]);

    const leadIds = Array.from(new Set((orders || []).map((o: any) => Array.isArray(o.lead_id) ? o.lead_id[0] : null).filter(Boolean)));
    const orderIds = (orders || []).map((o: any) => o.id);

    const [leads, kairosRows] = await Promise.all([
      // priority: campo NATIVO Odoo (crm.lead, mai usato finora in questo
      // progetto) - 10/09/2026 (Denis: "un'azione importante che colora il
      // lead di giallo o arancio"), riusato invece di inventare un campo.
      leadIds.length
        ? odoo.execute('crm.lead', 'search_read', [
            [['id', 'in', leadIds]], ['id', 'partner_name', 'contact_name', 'name', 'user_id', 'priority'],
          ])
        : Promise.resolve([]),
      orderIds.length
        ? odoo.execute('erpv6.kairos.matrix', 'search_read', [
            [['res_model', '=', 'erpv6.production.order'], ['res_id', 'in', orderIds]],
            ['res_id', 'quadrante', 'prontezza_totale', 'assessment_date'], 0, 0, 'id desc',
          ])
        : Promise.resolve([]),
    ]);

    const leadById = new Map<number, any>((leads || []).map((l: any) => [l.id, l]));
    const latestKairosByOrder = new Map<number, any>();
    for (const k of kairosRows || []) {
      if (!latestKairosByOrder.has(k.res_id)) latestKairosByOrder.set(k.res_id, k);
    }

    const projects = (orders || []).map((o: any) => {
      const leadId = Array.isArray(o.lead_id) ? o.lead_id[0] : null;
      const lead = leadId ? leadById.get(leadId) : null;
      const kairos = latestKairosByOrder.get(o.id);
      return {
        id: o.id,
        leadId,
        nome: o.name || '',
        cliente: lead?.partner_name || lead?.contact_name || lead?.name || '—',
        stato: Array.isArray(o.phase_id) ? o.phase_id[1] : 'Senza fase',
        consulente: Array.isArray(lead?.user_id) ? lead.user_id[1] : 'Non assegnato',
        consulenteId: Array.isArray(lead?.user_id) ? lead.user_id[0] : null,
        dataInizio: o.create_date || null,
        ultimoAggiornamento: o.write_date || o.create_date || null,
        priorita: lead?.priority || '0',
        kairos: kairos ? {
          score: kairos.prontezza_totale,
          quadrante: QUADRANTE_MAP[kairos.quadrante] || kairos.quadrante,
        } : null,
      };
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/projects:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
