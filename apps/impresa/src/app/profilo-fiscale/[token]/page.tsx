"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

// 23/09/2026: pagina ISOLATA per compilare dati fiscali da magic link.
// Design Kaizen: mostra tutti i campi (Christian puo' correggere errori
// passati), evidenzia quelli mancanti con bordo arancio, badge contatore
// in cima, validazione live, bottone disabilitato finche' non completo.

type FormState = {
    codice_fiscale: string;
    vat: string;
    street: string;
    street2: string;
    city: string;
    zip: string;
};

const EMPTY: FormState = {
    codice_fiscale: '', vat: '', street: '', street2: '', city: '', zip: '',
};

export default function ProfiloFiscaleTokenPage() {
    const params = useParams();
    const token = params?.token as string;
    const [state, setState] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [jwt, setJwt] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [originalForm, setOriginalForm] = useState<FormState>(EMPTY);
    const [declaration, setDeclaration] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                const res = await fetch(`/api/auth/magic-link/${token}`, { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok || data.error) {
                    setError(data.error || 'Link non valido');
                    setState('error');
                    return;
                }
                setJwt(data.token);
                const fRes = await fetch('/api/consultant/me/fiscal-data', {
                    headers: { Authorization: `JWT ${data.token}` },
                });
                if (fRes.ok) {
                    const f = await fRes.json();
                    const loaded: FormState = {
                        codice_fiscale: (f.codice_fiscale || '').toUpperCase(),
                        vat: f.vat || '',
                        street: f.street || '',
                        street2: f.street2 || '',
                        city: f.city || '',
                        zip: f.zip || '',
                    };
                    setForm(loaded);
                    setOriginalForm(loaded);
                }
                setState('form');
            } catch (e: any) {
                setError(e.message);
                setState('error');
            }
        })();
    }, [token]);

    // Validazione live
    const cfOk = form.codice_fiscale.length === 16;
    const pivaOk = !form.vat || (form.vat.length === 11 && /^\d+$/.test(form.vat));
    const streetOk = form.street.trim().length > 0;
    const cityOk = form.city.trim().length > 0;
    const zipOk = form.zip.length === 5 && /^\d+$/.test(form.zip);

    const missingFields = useMemo(() => {
        const m: string[] = [];
        if (!cfOk) m.push('codice_fiscale');
        if (!streetOk) m.push('street');
        if (!cityOk) m.push('city');
        if (!zipOk) m.push('zip');
        return m;
    }, [cfOk, streetOk, cityOk, zipOk]);

    const allValid = missingFields.length === 0 && pivaOk;
    const canSave = allValid && declaration && !saving;

    // Helper: evidenzia bordo arancio se vuoto
    const inputClass = (value: string, ok: boolean) => {
        const base = "w-full px-3 py-2 rounded-lg border text-sm transition-colors ";
        if (!value.trim()) return base + "border-amber-400 bg-amber-50/30";
        if (!ok) return base + "border-red-400 bg-red-50/30";
        return base + "border-gray-200";
    };

    const save = async () => {
        if (!jwt || !canSave) return;
        setSaving(true); setSaveError(null);
        try {
            const res = await fetch('/api/consultant/me/fiscal-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${jwt}` },
                body: JSON.stringify({ ...form, declaration_accepted: declaration }),
            });
            const d = await res.json();
            if (!res.ok || d.error) {
                setSaveError(d.error || 'Errore salvataggio');
                return;
            }
            setState('done');
        } catch (e: any) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white flex items-center justify-center px-6 py-12">
            <div className="max-w-lg w-full">
                {state === 'loading' && (
                    <div className="text-center">
                        <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Verifica link…</p>
                    </div>
                )}

                {state === 'error' && (
                    <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
                        <XCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-red-700 mb-2">Link non valido</h1>
                        <p className="text-sm text-gray-600">{error}</p>
                        <p className="text-xs text-gray-400 mt-4">Chiedi a V6 Impresa un nuovo invio.</p>
                    </div>
                )}

                {state === 'done' && (
                    <div className="bg-white rounded-2xl border border-emerald-100 p-8 text-center">
                        <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-emerald-700 mb-2">Dati salvati</h1>
                        <p className="text-sm text-gray-600">
                            Grazie. Riceverai per email il documento di split da firmare.
                        </p>
                        <p className="text-xs text-gray-400 mt-4">Puoi chiudere questa pagina.</p>
                    </div>
                )}

                {state === 'form' && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                        <h1 className="text-2xl font-bold text-[#1a2744] mb-2">Completa i tuoi dati fiscali</h1>
                        <p className="text-sm text-gray-500 mb-4">
                            Servono per generare l'accordo di split V6. La dichiarazione è vincolante.
                        </p>

                        {/* Badge contatore mancanti */}
                        {missingFields.length > 0 ? (
                            <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                <span className="text-sm text-amber-800">
                                    <b>{missingFields.length}</b> {missingFields.length === 1 ? 'campo obbligatorio da compilare' : 'campi obbligatori da compilare'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                <span className="text-sm text-emerald-800">Tutti i campi obbligatori sono completi</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Codice Fiscale *
                                    {!cfOk && form.codice_fiscale.length > 0 && (
                                        <span className="text-red-500 ml-2 font-normal">
                                            ({16 - form.codice_fiscale.length > 0 ? `mancano ${16 - form.codice_fiscale.length} caratteri` : 'lunghezza errata'})
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    maxLength={16}
                                    value={form.codice_fiscale}
                                    onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                                    className={inputClass(form.codice_fiscale, cfOk) + " font-mono uppercase"}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">P.IVA (opzionale)</label>
                                <input
                                    type="text"
                                    maxLength={11}
                                    value={form.vat}
                                    onChange={(e) => setForm({ ...form, vat: e.target.value.replace(/\D/g, '') })}
                                    className={inputClass(form.vat || 'ok', pivaOk) + " font-mono"}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Indirizzo *</label>
                                <input
                                    type="text"
                                    value={form.street}
                                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                                    className={inputClass(form.street, streetOk)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Riga 2 (opzionale)</label>
                                <input
                                    type="text"
                                    value={form.street2}
                                    onChange={(e) => setForm({ ...form, street2: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Città *</label>
                                    <input
                                        type="text"
                                        value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                                        className={inputClass(form.city, cityOk)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">CAP *</label>
                                    <input
                                        type="text"
                                        maxLength={5}
                                        value={form.zip}
                                        onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, '') })}
                                        className={inputClass(form.zip, zipOk) + " font-mono"}
                                    />
                                </div>
                            </div>
                        </div>

                        <label className="flex items-start gap-2 mt-5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={declaration}
                                onChange={(e) => setDeclaration(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span className="text-xs text-gray-700">
                                <b>Dichiaro che i dati sopra sono veritieri e completi.</b> Verranno usati per documenti contrattuali a mio nome.
                            </span>
                        </label>

                        {saveError && (
                            <div className="mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                                {saveError}
                            </div>
                        )}

                        <button
                            onClick={save}
                            disabled={!canSave}
                            className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                            {missingFields.length > 0 ? `Compila ${missingFields.length} campi per continuare` :
                             !declaration ? 'Spunta la dichiarazione per continuare' :
                             'Salva dati fiscali'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
