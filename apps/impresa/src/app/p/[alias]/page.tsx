"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, CheckCircle2, Building2, Target, Users } from "lucide-react";

export default function PublicPitchPage() {
    const params = useParams();
    const alias = params?.alias as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', company_name: '', email: '', phone: '', proposal: '' });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!alias) return;
        fetch(`/api/public/project/${alias}/pitch`)
            .then((r) => r.json())
            .then((d) => { if (!d.error) setData(d); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [alias]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim()) { alert('Nome ed email obbligatori'); return; }
        setSending(true);
        try {
            const res = await fetch(`/api/public/project/${alias}/candidacy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (!res.ok || d.error) { alert(d.error || 'Invio fallito'); return; }
            setSent(true);
        } catch { alert('Errore di rete'); }
        finally { setSending(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;
    if (!data) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center"><h1 className="text-2xl font-bold text-gray-800">Progetto non trovato</h1>
                <p className="text-gray-500 mt-2">Il link non è più attivo o il progetto non ha un pitch pubblico.</p></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <header className="mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
                        <Building2 size={14} /> V6 Impresa
                    </div>
                    <h1 className="text-4xl font-bold text-[#1a2744] mb-3">{data.title}</h1>
                    {data.settore && <p className="text-sm text-gray-500 uppercase tracking-wider">{data.settore}</p>}
                </header>

                {data.summary && (
                    <section className="mb-8 prose max-w-none">
                        <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
                    </section>
                )}

                {data.obiettivo && (
                    <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><Target size={14} /> Obiettivo</h2>
                        <p className="text-gray-700">{data.obiettivo}</p>
                    </section>
                )}

                {data.kpi_pubblici && data.kpi_pubblici.length > 0 && (
                    <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {data.kpi_pubblici.map((k: any, i: number) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                                <div className="text-2xl font-bold text-[#1a2744]">{k.value}</div>
                                <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                            </div>
                        ))}
                    </section>
                )}

                {data.parti && data.parti.length > 0 && (
                    <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><Users size={14} /> Aziende già attive</h2>
                        <div className="flex flex-wrap gap-2">
                            {data.parti.map((p: any, i: number) => (
                                <span key={i} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                                    {p.name}{p.ruolo ? ` · ${p.ruolo}` : ''}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    {sent ? (
                        <div className="text-center py-8">
                            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-[#1a2744] mb-2">Candidatura inviata</h2>
                            <p className="text-gray-600">Ti contatteremo a breve per valutare insieme la collaborazione.</p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-[#1a2744] mb-1">Ti rivedi in questo progetto?</h2>
                            <p className="text-sm text-gray-600 mb-6">Candidati come partner o segnala un'azienda interessata. Ti ricontattiamo entro pochi giorni.</p>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                                        <input type="text" required value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Azienda</label>
                                        <input type="text" value={form.company_name}
                                            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                                        <input type="email" required value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Telefono</label>
                                        <input type="tel" value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Come pensi di partecipare</label>
                                    <textarea rows={4} value={form.proposal}
                                        onChange={(e) => setForm({ ...form, proposal: e.target.value })}
                                        placeholder="Candidatura come partner, segnalazione di un'azienda, altre idee…"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y" />
                                </div>
                                <button type="submit" disabled={sending}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50">
                                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Invia candidatura
                                </button>
                            </form>
                        </>
                    )}
                </section>

                <footer className="mt-8 text-center text-xs text-gray-400">
                    V6 Impresa AI · {data.views} visualizzazioni
                </footer>
            </div>
        </div>
    );
}
