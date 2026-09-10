import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "anche tutta la parte delle commissioni consulenti
// e referral"): commissione = tranche REALMENTE incassata x aliquota
// reale del consulente (erpv6.consulting.consultant.commission_rate,
// gia' collegata oggi in Team) - nessuna formula inventata, solo
// applicare un'aliquota gia' configurata a un incasso gia' confermato.
//
// Scope di questa prima versione: solo le tranche di consulenza
// (erpv6.production.order.tranche, incasso confermato a mano) - i
// pagamenti online Win-Win non hanno ancora un collegamento verificato
// a un consulente specifico (sale.order non porta lead_id/user_id in
// modo diretto), quindi non li attribuiamo per non indovinare.
export async function GET() {
  try {
    await odoo.connect();

    const paidTranches = await odoo.execute('erpv6.production.order.tranche', 'search_read', [
      [['stato', '=', 'incassata']], ['id', 'importo', 'order_id', 'data_incasso'],
    ]);
    if (!paidTranches || !paidTranches.length) {
      return NextResponse.json({ success: true, commissions: [] });
    }

    const orderIds = Array.from(new Set(paidTranches.map((t: any) => Array.isArray(t.order_id) ? t.order_id[0] : t.order_id)));
    const orders = await odoo.execute('erpv6.production.order', 'search_read', [
      [['id', 'in', orderIds]], ['id', 'lead_id'],
    ]);
    const leadByOrder = new Map<number, number>(
      (orders || []).map((o: any) => [o.id, Array.isArray(o.lead_id) ? o.lead_id[0] : null])
    );

    const leadIds = Array.from(new Set(Array.from(leadByOrder.values()).filter(Boolean)));
    const leads = leadIds.length
      ? await odoo.execute('crm.lead', 'search_read', [[['id', 'in', leadIds]], ['id', 'user_id']])
      : [];
    const userByLead = new Map<number, number>(
      (leads || []).map((l: any) => [l.id, Array.isArray(l.user_id) ? l.user_id[0] : null])
    );

    const userIds = Array.from(new Set(Array.from(userByLead.values()).filter(Boolean)));
    const users = userIds.length
      ? await odoo.execute('res.users', 'search_read', [[['id', 'in', userIds]], ['id', 'partner_id']])
      : [];
    const partnerByUser = new Map<number, number>(
      (users || []).map((u: any) => [u.id, Array.isArray(u.partner_id) ? u.partner_id[0] : null])
    );

    const partnerIds = Array.from(new Set(Array.from(partnerByUser.values()).filter(Boolean)));
    const consultants = partnerIds.length
      ? await odoo.execute('erpv6.consulting.consultant', 'search_read', [
          [['partner_id', 'in', partnerIds]], ['id', 'name', 'partner_id', 'commission_rate'],
        ])
      : [];
    const consultantByPartner = new Map<number, any>(
      (consultants || []).map((c: any) => [Array.isArray(c.partner_id) ? c.partner_id[0] : c.partner_id, c])
    );

    const byConsultant = new Map<number, { name: string; rate: number; totalIncassato: number; commissione: number; tranche: number }>();

    for (const t of paidTranches) {
      const orderId = Array.isArray(t.order_id) ? t.order_id[0] : t.order_id;
      const leadId = leadByOrder.get(orderId);
      if (!leadId) continue;
      const userId = userByLead.get(leadId);
      if (!userId) continue;
      const partnerId = partnerByUser.get(userId);
      if (!partnerId) continue;
      const consultant = consultantByPartner.get(partnerId);
      if (!consultant) continue;

      const entry = byConsultant.get(consultant.id) || {
        name: consultant.name, rate: consultant.commission_rate || 0, totalIncassato: 0, commissione: 0, tranche: 0,
      };
      entry.totalIncassato += t.importo || 0;
      entry.commissione += (t.importo || 0) * (consultant.commission_rate || 0) / 100;
      entry.tranche += 1;
      byConsultant.set(consultant.id, entry);
    }

    return NextResponse.json({
      success: true,
      commissions: Array.from(byConsultant.entries()).map(([id, v]) => ({
        consultantId: id,
        nome: v.name,
        aliquota: v.rate,
        totaleIncassato: v.totalIncassato,
        commissione: v.commissione,
        numeroTranche: v.tranche,
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/commissions:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
