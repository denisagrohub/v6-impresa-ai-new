import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "per aggiungere ad un progetto esistente una parte
// collegata"): crea un nodo figlio erpv6.tracking.relation sotto il
// progetto - stesso find-or-create per email gia' usato per consulenti
// e referral (mai un duplicato di res.partner per la stessa email).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10);
  if (!projectId) return NextResponse.json({ success: false, error: 'ID progetto non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { name, email, phone, ruolo, mandato, partnerId: selectedPartnerId } = body || {};
  if (!name) {
    return NextResponse.json({ success: false, error: 'Il nome è obbligatorio' }, { status: 400 });
  }

  try {
    await odoo.connect();

    // 10/09/2026 (Denis: "deve essere possibile selezionarlo o crearlo") -
    // partnerId valorizzato = contatto ESISTENTE scelto dall'autocomplete
    // (nessuna ricerca/creazione, usato cosi' com'è); altrimenti stesso
    // find-or-create per email di prima, per non duplicare un contatto se
    // l'email coincide con uno già presente ma l'admin non l'ha selezionato.
    let partnerId: number | false = selectedPartnerId || false;
    if (!partnerId && email) {
      const existingPartners = await odoo.execute('res.partner', 'search_read', [
        [['email', '=', email]], ['id'], 0, 1,
      ]);
      if (existingPartners && existingPartners.length) {
        partnerId = existingPartners[0].id;
      } else {
        partnerId = await odoo.execute('res.partner', 'create', [{ name, email, phone: phone || false }]);
      }
    }

    const childId = await odoo.execute('erpv6.tracking.relation', 'create', [{
      name,
      parent_id: projectId,
      partner_id: partnerId,
      ruolo: ruolo || false,
      mandato: mandato || false,
    }]);

    return NextResponse.json({ success: true, partId: childId });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/partner-projects/[id]/parts:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
