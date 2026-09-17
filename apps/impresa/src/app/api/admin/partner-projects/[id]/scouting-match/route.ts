import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 14/09/2026 - Area Lavoro / Scouting Progetto (v1 regole esplicite):
// legge tutti i res.partner con x_v6_scouting e li classifica per
// affinita' col profilo del progetto. Profilo v1 = keyword derivate dal
// nome progetto (TEE -> energia/ambiente/certificati) + bonus se i campi
// fit dello scouting sono compilati. Trasparente e spiegabile: il punteggio
// riporta SEMPRE il perche' (matched keywords). Evolvera' a
// confidence-weighted quando i DNA v2 saranno numerosi.
const PROFILI: Record<string, string[]> = {
  tee: ['energia', 'energy', 'ambiente', 'ambientale', 'certificat', 'efficienza', 'es_certs', 'gme', 'rinnovabili'],
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const projectId = parseInt((await params).id, 10);
  if (!projectId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    // profilo progetto: nome della tracking.relation padre
    const proj = await odoo.execute('erpv6.tracking.relation', 'read', [[projectId]], { fields: ['name'] });
    const projName: string = (proj?.[0]?.name || '').toLowerCase();

    // keyword: profilo noto + parole lunghe dal nome progetto
    let keywords = [...new Set(Object.entries(PROFILI).find(([k]) => projName.includes(k))?.[1] || [])];
    for (const w of projName.split(/[^a-zà-ù]+/)) if (w.length >= 5) keywords.push(w);
    keywords = [...new Set(keywords)].filter(Boolean);

    // tutti gli scouting livello 1
    const partners = await odoo.execute('res.partner', 'search_read', [
      [['x_v6_scouting', '!=', false], ['is_company', '=', true]],
      ['id', 'name', 'x_v6_scouting'], 0, 200,
    ]);

    const results = (partners || []).map((p: any) => {
      let scouting: any = null;
      try { scouting = JSON.parse(p.x_v6_scouting); } catch { return null; }
      const haystack = JSON.stringify(scouting).toLowerCase();
      const matched = keywords.filter(k => haystack.includes(k));
      const fitFields = Object.values(scouting.fit || {}).filter((v: any) => v && String(v).trim()).length;
      const score = Math.min(100, matched.length * 22 + fitFields * 5);
      return {
        partnerId: p.id, name: p.name, score, version: scouting.version || 1,
        matched, fitFields,
        settore: scouting.identita?.settore || 'n.d.',
        ragione: matched.length ? `Match: ${matched.join(', ')}` : 'Nessuna keyword — solo completezza scouting',
      };
    }).filter(Boolean);

    results.sort((a: any, b: any) => b.score - a.score);
    return NextResponse.json({ success: true, profile: keywords, results });
  } catch (error: any) {
    console.error('❌ scouting-match:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore' }, { status: 502 });
  }
}
