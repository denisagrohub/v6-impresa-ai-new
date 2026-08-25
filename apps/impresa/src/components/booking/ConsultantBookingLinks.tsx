'use client';
import { useEffect, useState } from 'react';
import { Copy, Loader2, Plus, Video, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
    consultantId: string | number | null; // erpv6.consulting.consultant.id
    token: string; // JWT della sessione, per generare nuovi link
}

// Pannello REALE (25/08/2026, Denis - "la parte da salvare e' sicuramente
// la call") sui link di prenotazione del consulente: legge/genera vere
// righe erpv6.booking.token via erpv6_api_gateway, non un JSON finto.
// Sostituisce concettualmente il calendario a giorno/ora che il vecchio
// frontend mockava - il modello Odoo reale non ha campi data/ora (e' un
// link monouso con sola scadenza), quindi qui non si "sceglie un orario",
// si genera/condivide un link che il consulente concorda poi a voce col
// cliente.
export function ConsultantBookingLinks({ consultantId, token }: Props) {
    const [loading, setLoading] = useState(true);
    const [tokens, setTokens] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const load = () => {
        if (!consultantId) { setLoading(false); return; }
        setLoading(true);
        fetch(`/api/consultant/public-slots?consultantId=${consultantId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) setError(data.error);
                else setTokens(data.tokens || []);
                setLoading(false);
            })
            .catch(() => { setError('Errore di connessione'); setLoading(false); });
    };

    useEffect(load, [consultantId]);

    const handleGenerate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await fetch('/api/consultant/public-slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
                body: JSON.stringify({ count: 1, validityHours: 72 }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Errore generazione link');
            } else {
                load();
            }
        } catch {
            setError('Errore di connessione');
        } finally {
            setGenerating(false);
        }
    };

    // Un solo link pubblico per consulente (/booking/<consultantId>): chi
    // lo apre vede TUTTI i token attualmente disponibili, non un token
    // specifico - la pagina pubblica non accetta un token nell'URL. Niente
    // "copia" per singolo token quindi: sarebbe lo stesso URL ripetuto,
    // fuorviante.
    const bookingUrl = typeof window !== 'undefined' ? `${window.location.origin}/booking/${consultantId}` : `/booking/${consultantId}`;

    const handleCopy = () => {
        navigator.clipboard?.writeText(bookingUrl);
        setCopiedToken(bookingUrl);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    if (!consultantId) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-yellow-800">
                Il tuo utente non e' ancora collegato a un record consulente (erpv6.consulting.consultant) in Odoo:
                nessun link di prenotazione puo' essere generato finche' non viene creato. Contatta l'amministratore.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-[#1a2744] flex items-center gap-2">
                    <Video size={18} className="text-orange-500" /> Link di Prenotazione Call
                </h3>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Genera nuovo link
                </button>
            </div>

            <button
                onClick={handleCopy}
                className="flex items-center gap-2 mb-4 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
                {copiedToken === bookingUrl ? <><CheckCircle2 size={14} /> Link copiato</> : <><Copy size={14} /> Copia il tuo link pubblico ({bookingUrl})</>}
            </button>

            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : tokens.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                    Nessun link attivo. Genera un link per condividerlo con un prospect e ricevere la sua richiesta di call.
                </p>
            ) : (
                <div className="space-y-2">
                    {tokens.map((t: any) => (
                        <div key={t.token} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                            <Clock size={14} />
                            Valido fino al {new Date(t.expires_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
