import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "dovrei avere la possibilità di fare alcune azioni
// ad esempio creare un progetto partner"): crea un progetto reale
// (erpv6.tracking.relation, stesso modello di "Progetto TEE") a partire
// dai dati gia' raccolti nella candidatura - nome azienda come nome
// progetto, il referente come prima parte collegata. Segna la
// candidatura 'in_valutazione' (non piu' 'nuova'): e' stata presa in
// carico, stesso schema di stato gia' esistente sul modello.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const candidacies = await odoo.execute('erpv6.partnership.candidacy', 'search_read', [
      [['id', '=', id]], ['name', 'company_name', 'email', 'phone'],
    ]);
    if (!candidacies || !candidacies.length) {
      return NextResponse.json({ success: false, error: 'Candidatura non trovata' }, { status: 404 });
    }
    const c = candidacies[0];
    const projectName = c.company_name || c.name;

    const projectId = await odoo.execute('erpv6.tracking.relation', 'create', [{
      name: projectName,
    }]);

    let partnerId: number | false = false;
    if (c.email) {
      const existingPartners = await odoo.execute('res.partner', 'search_read', [
        [['email', '=', c.email]], ['id'], 0, 1,
      ]);
      if (existingPartners && existingPartners.length) {
        partnerId = existingPartners[0].id;
      } else {
        partnerId = await odoo.execute('res.partner', 'create', [{ name: c.name, email: c.email, phone: c.phone || false }]);
      }
    }
    await odoo.execute('erpv6.tracking.relation', 'create', [{
      name: c.name,
      parent_id: projectId,
      partner_id: partnerId,
      ruolo: 'parte_attiva',
    }]);

    await odoo.execute('erpv6.partnership.candidacy', 'write', [[id], { state: 'in_valutazione' }]);

    return NextResponse.json({ success: true, projectId });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/candidacies/[id]/create-project:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
