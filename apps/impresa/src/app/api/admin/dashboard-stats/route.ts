import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Dati reali per /admin/dashboard (10/09/2026, Denis: "vorrei che avesse
// tutte le cose necessarie e i dati reali non mockup"). Bypassa
// volutamente il gateway generico (@erpv6/gateway-client -> /api/gateway,
// pilotato da secure-config.json che oggi ha useOdoo:false) e parla
// direttamente a Odoo con lo stesso adapter gia' reale e verificato di
// /api/odoo/status - nessuna modifica al flag globale, che ha un raggio
// d'azione su altre feature non ancora verificato.
//
// EVENT_TYPE_LABELS ripete la selection di erpv6.production.event
// (odoo-modules/erpv6_production/models/production_event.py) perche'
// execute_kw non restituisce la label, solo il valore tecnico.
const EVENT_TYPE_LABELS: Record<string, string> = {
  interazione_consulente: '💬 Interazione consulente',
  cron_automatico: '⚙️ Cron automatico',
  documento_generato: '📄 Documento generato',
  risorsa_assegnata: '👤 Risorsa assegnata',
};

// Formato datetime atteso da Odoo nei domini di ricerca ('YYYY-MM-DD HH:MM:SS', UTC).
function odooDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function GET() {
  try {
    await odoo.connect();

    const last24h = odooDatetime(new Date(Date.now() - 24 * 3600 * 1000));

    const [
      modules,
      productionOrderCount,
      relationsWithPartner,
      partnershipProjectsCount,
      kbRequestsPendingCount,
      certifiedDocsCount,
      consultants,
      candidacies,
      recentEvents,
      productionEventCount,
      projectsNeedingDecisionCount,
      newCandidaciesCount,
      certifiedDocsRecentCount,
    ] = await Promise.all([
      odoo.execute('ir.module.module', 'search_read', [[['name', 'ilike', 'erpv6_'], ['state', '=', 'installed']], ['name']]),
      // "Progetti Totali" deve contare la STESSA cosa mostrata aprendo
      // /admin/projects (10/09/2026, Denis: "i valori dei progetti...
      // non sono corretti") - prima contava erpv6.tracking.relation
      // (i "Progetti Partner" tipo TEE, un concetto diverso), qui invece
      // erpv6.production.order come la pagina Progetti.
      odoo.execute('erpv6.production.order', 'search_count', [[]]),
      odoo.execute('erpv6.tracking.relation', 'search_read', [[['partner_id', '!=', false]], ['partner_id']]),
      // "Brand Projects" -> "Partnership Projects" (10/09/2026, Denis:
      // "al posto di brand projects metti i partnership project") -
      // stesso numero gia' mostrato dalla lista candidacies sotto.
      odoo.execute('erpv6.partnership.candidacy', 'search_count', [[]]),
      odoo.execute('erpv6.kb.request', 'search_count', [[['status', '=', 'pending']]]),
      odoo.execute('erpv6.library.document', 'search_count', [[['blockchain_record_id', '!=', false]]]),
      odoo.execute('erpv6.consulting.consultant', 'search_read', [[], ['id']]),
      odoo.execute('erpv6.partnership.candidacy', 'search_read', [
        [], ['name', 'company_name', 'email', 'phone', 'state', 'create_date'], 0, 20, 'create_date desc',
      ]),
      odoo.execute('erpv6.production.event', 'search_read', [
        [], ['event_type', 'description', 'create_date', 'order_id'], 0, 8, 'create_date desc',
      ]),
      odoo.execute('erpv6.production.event', 'search_count', [[]]),
      // "Nuovo" per ciascuna delle 4 card (10/09/2026, Denis: "fai in
      // modo che su tutti e 4 se ci sono notifiche nuove il bordo
      // lampeggi rosso") - un segnale reale per ognuna, mai inventato:
      // - Progetti: erpv6.production.order con un phase_gate_task_id
      //   aperto (task di decisione fase non ancora completato, vedi
      //   production_order.py advance_phase/_request_phase_decision).
      odoo.execute('erpv6.production.order', 'search_count', [
        [['phase_gate_task_id', '!=', false], ['phase_gate_task_id.state', '!=', '1_done']],
      ]),
      // - Partnership: candidature con state='nuova' (valore di default
      //   alla creazione, prima che qualcuno le apra/valuti).
      odoo.execute('erpv6.partnership.candidacy', 'search_count', [[['state', '=', 'nuova']]]),
      // - Documenti Certificati: nessuno stato "da rivedere" esiste per
      //   un documento gia' certificato - unica soglia reale disponibile
      //   e' la freschezza (certificato nelle ultime 24h). Richieste KB
      //   e' gia' filtrata su status='pending' sopra, quindi "nuove" e'
      //   lo stesso conteggio (nessuna query aggiuntiva).
      odoo.execute('erpv6.library.document', 'search_count', [
        [['blockchain_record_id', '!=', false], ['create_date', '>=', last24h]],
      ]),
    ]);

    const distinctClientPartnerIds = new Set(
      (relationsWithPartner || [])
        .map((r: any) => (Array.isArray(r.partner_id) ? r.partner_id[0] : r.partner_id))
        .filter(Boolean)
    );

    const recentActivities = (recentEvents || []).map((e: any) => ({
      type: e.event_type,
      icon: EVENT_TYPE_LABELS[e.event_type]?.slice(0, 2) || '🔵',
      title: `${EVENT_TYPE_LABELS[e.event_type] || e.event_type}${e.order_id ? ' — ' + e.order_id[1] : ''}${e.description ? ': ' + e.description : ''}`,
      time: e.create_date || '',
    }));

    return NextResponse.json({
      success: true,
      stats: {
        projects: productionOrderCount || 0,
        partnershipProjects: partnershipProjectsCount || 0,
        kbRequests: kbRequestsPendingCount || 0,
        certifiedDocs: certifiedDocsCount || 0,
        consultants: (consultants || []).length,
        clients: distinctClientPartnerIds.size,
        modulesActive: (modules || []).length,
        auditLogCount: productionEventCount || 0,
      },
      newCounts: {
        projects: projectsNeedingDecisionCount || 0,
        partnershipProjects: newCandidaciesCount || 0,
        kbRequests: kbRequestsPendingCount || 0,
        certifiedDocs: certifiedDocsRecentCount || 0,
      },
      candidacies: candidacies || [],
      recentActivities,
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/dashboard-stats:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
