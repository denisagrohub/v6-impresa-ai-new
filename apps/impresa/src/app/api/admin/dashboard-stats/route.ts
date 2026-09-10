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

export async function GET() {
  try {
    await odoo.connect();

    const [
      modules,
      rootProjects,
      relationsWithPartner,
      brandProjectsCount,
      kbRequestsPendingCount,
      certifiedDocsCount,
      consultants,
      candidacies,
      recentEvents,
      productionEventCount,
    ] = await Promise.all([
      odoo.execute('ir.module.module', 'search_read', [[['name', 'ilike', 'erpv6_'], ['state', '=', 'installed']], ['name']]),
      odoo.execute('erpv6.tracking.relation', 'search_count', [[['parent_id', '=', false]]]),
      odoo.execute('erpv6.tracking.relation', 'search_read', [[['partner_id', '!=', false]], ['partner_id']]),
      odoo.execute('erpv6.brand.project', 'search_count', [[]]),
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
        projects: rootProjects || 0,
        brandProjects: brandProjectsCount || 0,
        kbRequests: kbRequestsPendingCount || 0,
        certifiedDocs: certifiedDocsCount || 0,
        consultants: (consultants || []).length,
        clients: distinctClientPartnerIds.size,
        modulesActive: (modules || []).length,
        auditLogCount: productionEventCount || 0,
      },
      candidacies: candidacies || [],
      recentActivities,
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/dashboard-stats:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
