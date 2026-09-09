'use client';
// Pagina report Win-Win (prompt web-async, 06/09/2026) - il teaser
// pre-pagamento raggiunto via link (email, Fase 2) o redirect diretto
// (InterviewTreeFlow.tsx, Fase 3, se il Gate 3B converge entro l'attesa).
//
// Principio non negoziabile (audit "Punto Zero" + prompt Fase 4): diagnosi,
// criticità, azioni urgenti e quadrante Kairós SEMPRE visibili per intero -
// solo sintesi/azioni win-win/roadmap/raccomandazione vanno dietro
// BlurLock. Non e' una scelta estetica: nascondere una criticità reale
// insieme alle opportunità per venderle sarebbe grave.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, Badge, Button } from '@erpv6/ui';
import BlurLock from '@/components/shared/BlurLock';
import { fetchWinwinReportData, requestWinwinReportPayment, type WinwinReportData } from '@/lib/winwin/report-client';

const STATO_COLOR: Record<string, string> = {
    rosso: 'text-red-700 bg-red-50 border-red-200',
    ambra: 'text-amber-700 bg-amber-50 border-amber-200',
    verde: 'text-green-700 bg-green-50 border-green-200',
};

function contaRossi(data: WinwinReportData): number {
    const rossiMetriche = data.diagnosi.metriche.filter((m) => m.stato === 'rosso').length;
    return rossiMetriche + data.criticita.length;
}

export default function WinwinReportPage() {
    const params = useParams();
    const token = params.token as string;
    const [data, setData] = useState<WinwinReportData | null>(null);
    const [notReady, setNotReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // 09/09/2026 (pagamento reale, audit "Punto Zero"): PRIMA questo era un
    // semplice setUnlocked(true) al click, zero pagamento - lo stato reale
    // arriva ora da data.preview (token.is_paid lato Odoo). paying/payError
    // coprono solo l'avvio del pagamento (redirect verso l'ordine Odoo),
    // non lo sblocco in se'.
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);

    const handleRequestPayment = async () => {
        setPaying(true);
        setPayError(null);
        try {
            const result = await requestWinwinReportPayment(token);
            if (result.payment_url) {
                window.location.href = result.payment_url;
            } else {
                setPaying(false);
            }
        } catch (err: any) {
            setPayError(err.message || 'Impossibile avviare il pagamento. Riprova o contattaci.');
            setPaying(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        fetchWinwinReportData(token)
            .then((result) => {
                if (cancelled) return;
                setData(result);
            })
            .catch((err: any) => {
                if (cancelled) return;
                if (String(err.message || '').includes('not_ready') || String(err.message).includes('202')) {
                    setNotReady(true);
                } else {
                    setError(err.message || 'Report non trovato o non più disponibile.');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    if (error) {
        return (
            <main className="min-h-screen bg-[#F7F3ED] py-16 flex items-center justify-center px-4">
                <Card className="p-8 max-w-md text-center">
                    <AlertTriangle size={40} className="text-red-600 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-[#1C2128] mb-2">Report non disponibile</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link href="/contatti">
                        <Button size="lg" fullWidth>Contattaci</Button>
                    </Link>
                </Card>
            </main>
        );
    }

    if (notReady) {
        return (
            <main className="min-h-screen bg-[#F7F3ED] py-16 flex items-center justify-center px-4">
                <Card className="p-8 max-w-md text-center">
                    <Loader2 size={40} className="text-[#D4703A] mx-auto mb-4 animate-spin" />
                    <h1 className="text-xl font-bold text-[#1C2128] mb-2">Il tuo report è ancora in elaborazione</h1>
                    <p className="text-gray-600">Ti mandiamo il link via email appena è pronto — puoi chiudere questa pagina tranquillamente.</p>
                </Card>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-[#F7F3ED] py-16 flex items-center justify-center">
                <Loader2 size={40} className="text-[#D4703A] animate-spin" />
            </main>
        );
    }

    const rossi = contaRossi(data);
    // Cross-sell condizionale (Fase 4 del prompt): SOLO se i dati del caso
    // lo giustificano esplicitamente - qui, 2+ elementi in stato rosso tra
    // metriche/criticità. Nessun box statico uguale per tutti i casi.
    const mostraCrossSell = rossi >= 2;

    // 06/09/2026 (feedback diretto): senza diagnosi/criticità/urgenti non
    // c'è sostanza per giustificare un'analisi a 49€ - meglio instradare a
    // una chiamata diretta che vendere un report vuoto.
    const casoVuoto =
        data.diagnosi.metriche.length === 0 && data.criticita.length === 0 && data.azioni_urgenti.length === 0;

    // Righe di testo REALE (mai lorem ipsum) da sfocare nel teaser -
    // descrizioni delle opportunità successive alla prima (la cui riga di
    // titolo resta sempre leggibile, vedi sotto), mai contenuto già
    // sempre-visibile (criticità/urgenti).
    const previewLines = [
        ...data.schede.slice(1, 4).map((s) => s.come_funziona).filter(Boolean),
        ...(data.raccomandazione ? [data.raccomandazione] : []),
    ].slice(0, 4);

    // 06/09/2026: punta al sistema di prenotazione reale (aeosv6_booking)
    // del consulente gia' assegnato al lead dalla regola di assegnazione
    // automatica esistente (crm.lead._auto_assign_consulente, letta lato
    // Motore in _resolve_consultant_for_booking) - MAI /booking/null,
    // fallback esplicito a /contatti se il lead non ha un consulente
    // risolto (es. assegnazione manuale non ancora fatta).
    const bookingHref = data.consultant_booking_id ? `/booking/${data.consultant_booking_id}` : '/contatti';

    const consulenteCard = mostraCrossSell ? (
        <Card className="p-6 border-2 border-[#0F1E3C] bg-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0F1E3C] mb-2">
                Vale la pena approfondire
            </p>
            <p className="text-sm text-gray-700 mb-4">
                La tua azienda ha più di un punto critico da affrontare insieme: in casi come questo un
                Business Plan completo, con il consulente al fianco su tutti i fronti, aiuta a mettere le
                priorità in ordine invece di risolverle una alla volta.
            </p>
            <Link href={bookingHref}>
                <Button variant="secondary" size="lg" fullWidth>Parliamone con un consulente</Button>
            </Link>
        </Card>
    ) : null;

    return (
        <main className="min-h-screen bg-[#F7F3ED] py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="text-center">
                    <Badge variant="primary" className="bg-[#0F1E3C] text-white mb-3">
                        {data.client_info.tipo_progetto || 'Report Win-Win'}
                    </Badge>
                    <h1 className="text-2xl font-bold text-[#1C2128]">{data.client_info.azienda}</h1>
                    <p className="text-sm text-gray-500">{data.client_info.data}</p>
                </header>

                {/* Quadrante Kairós - sempre visibile */}
                <Card className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#D4703A] mb-2">Posizione attuale</p>
                    <p className="text-lg font-bold text-[#1C2128] mb-3 capitalize">
                        {(data.etichetta_azienda || '').replace(/_/g, ' ')}
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500">Impatto</span>
                            <p className="font-semibold text-[#1C2128]">{Math.round(data.impatto)}%</p>
                        </div>
                        <div>
                            <span className="text-gray-500">Prontezza</span>
                            <p className="font-semibold text-[#1C2128]">{Math.round(data.prontezza)}%</p>
                        </div>
                    </div>
                </Card>

                {consulenteCard}

                {/* Diagnosi - sempre visibile per intero */}
                {data.diagnosi.metriche.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-[#1C2128] mb-4">Diagnosi</h2>
                        <div className="space-y-3">
                            {data.diagnosi.metriche.map((m, i) => (
                                <div key={i} className={`p-4 rounded-xl border ${STATO_COLOR[m.stato] || 'border-gray-200'}`}>
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-semibold">{m.nome}</span>
                                        <span className="text-lg font-bold">{m.valore}</span>
                                    </div>
                                    {m.riferimento && <p className="text-xs mt-1 opacity-80">{m.riferimento}</p>}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Criticità - sempre visibile per intero, MAI sfocata */}
                {data.criticita.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-[#1C2128] mb-4">Criticità da conoscere</h2>
                        <ul className="space-y-3">
                            {data.criticita.map((c, i) => (
                                <li key={i} className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900">
                                    {c.descrizione || c.titolo || JSON.stringify(c)}
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                {/* Azioni urgenti - sempre visibile per intero, MAI sfocata */}
                {data.azioni_urgenti.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-[#1C2128] mb-4">Azioni urgenti</h2>
                        <ul className="space-y-3">
                            {data.azioni_urgenti.map((a, i) => (
                                <li key={i} className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
                                    {a.descrizione || a.titolo || JSON.stringify(a)}
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                {/* Sezione sfocata: sintesi, azioni win-win, roadmap, raccomandazione */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-[#1C2128] mb-4">Le opportunità per la tua azienda</h2>
                    {data.schede.length > 0 && (
                        <div>
                            {/* Prima riga della prima opportunità sempre leggibile per intero
                                (vincolo esplicito del componente BlurLock) - fuori dall'area
                                coperta dal BlurLock, mai sovrapposta al velo sfocato sotto. */}
                            <p className="font-semibold text-[#1C2128] mb-3">{data.schede[0].titolo}</p>
                            {!data.preview ? (
                                <div className="space-y-4">
                                    {data.schede.map((s, i) => (
                                        <div key={i} className="text-sm text-gray-700">
                                            <p className="font-semibold text-[#1C2128]">{s.titolo}</p>
                                            <p>{s.come_funziona}</p>
                                        </div>
                                    ))}
                                    {data.roadmap.length > 0 && (
                                        <div>
                                            <p className="font-semibold text-[#1C2128] mb-2">La tua roadmap</p>
                                            {data.roadmap.map((r, i) => (
                                                <p key={i} className="text-sm text-gray-700">
                                                    <span className="font-semibold">{r.tempistica}:</span> {r.titolo} — {r.descrizione}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {data.raccomandazione && (
                                        <div>
                                            <p className="font-semibold text-[#1C2128] mb-1">Dove andare</p>
                                            <p className="text-sm text-gray-700">{data.raccomandazione}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative overflow-hidden rounded-lg" style={{ minHeight: 400 }}>
                                    <BlurLock
                                        onUnlock={handleRequestPayment}
                                        unlocking={paying}
                                        unlockError={payError}
                                        previewLines={previewLines}
                                        casoVuoto={casoVuoto}
                                        bookingHref={bookingHref}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </main>
    );
}
