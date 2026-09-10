import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis, esempio Progetto TEE/Trader): segnalazioni Heinrich
// (near_miss/lieve/grave) applicate al flusso di lavoro con un
// progetto/parte - riusa erpv6.heinrich.indicator.log_signal(), motore
// gia' reale (erpv6_methodology), polimorfico su res_model/res_id: qui
// puo' puntare sia a un nodo erpv6.tracking.relation (una parte
// collegata, es. "Trader") sia a un erpv6.production.order.
//
// "cultura_organizzativa" (toyota/ford_silenziosa/non_determinabile) e'
// gia' calcolata dal modello stesso (euristica esistente, non
// reinventata qui) - e' la lettura di "affidabilita'" che Denis
// descriveva, mai un punteggio numerico fabbricato da zero.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resModel = searchParams.get('resModel');
  const resId = searchParams.get('resId');
  if (!resModel || !resId) {
    return NextResponse.json({ success: false, error: 'resModel e resId sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const indicators = await odoo.execute('erpv6.heinrich.indicator', 'search_read', [
      [['res_model', '=', resModel], ['res_id', '=', parseInt(resId, 10)]],
      ['id', 'near_miss_segnalati', 'problemi_lievi', 'eventi_gravi', 'cultura_organizzativa', 'note'],
      0, 1,
    ]);
    const indicator = indicators && indicators[0];
    return NextResponse.json({
      success: true,
      indicator: indicator ? {
        nearMiss: indicator.near_miss_segnalati,
        problemiLievi: indicator.problemi_lievi,
        eventiGravi: indicator.eventi_gravi,
        cultura: indicator.cultura_organizzativa,
        note: indicator.note || '',
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { resModel, resId, severity, description } = body || {};
  if (!resModel || !resId || !severity) {
    return NextResponse.json({ success: false, error: 'resModel, resId e severity sono obbligatori' }, { status: 400 });
  }
  if (!['near_miss', 'lieve', 'grave'].includes(severity)) {
    return NextResponse.json({ success: false, error: "severity deve essere 'near_miss', 'lieve' o 'grave'" }, { status: 400 });
  }

  try {
    await odoo.connect();
    await odoo.execute('erpv6.heinrich.indicator', 'log_signal', [resModel, Number(resId), severity, description || false]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/heinrich:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Registrazione fallita' }, { status: 502 });
  }
}
