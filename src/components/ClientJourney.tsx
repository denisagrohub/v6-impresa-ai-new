"use client";
import { calcolaPrezzoL3, type PricingInput } from '@/lib/pricing-engine';
import { calcolaLeadScore } from '@/lib/lead-scoring';
import { useState, useEffect } from "react";
import {
    ArrowRight, ArrowLeft, CheckCircle2, TrendingUp, Shield,
    FileText, Calendar, Download, Save, Clock
} from "lucide-react";

interface ClientJourneyProps {
    level: 'L1' | 'L2' | 'L3';
    onComplete: (data: any) => void;
    draftId?: string;
}

export default function ClientJourney({ level, onComplete, draftId }: ClientJourneyProps) {
    const [step, setStep] = useState(1);
    const [tipoRichiedente, setTipoRichiedente] = useState<'azienda' | 'consulente' | 'intermediario' | null>(null);
    const [stimaL3, setStimaL3] = useState<number | null>(null);
    const [stimaMaxL3, setStimaMaxL3] = useState<number | null>(null);
    const [draftSaved, setDraftSaved] = useState(false);
    const [callSlot, setCallSlot] = useState<string>('');
    const [complessitaProgetto, setComplessitaProgetto] = useState<'bassa' | 'media' | 'alta'>('media');
    const [leadScore, setLeadScore] = useState<any>(null);

    // Calcolo totale step in base al livello
    const totalSteps = level === 'L1' ? 3 : level === 'L2' ? 4 : 5;

    const [formData, setFormData] = useState({
        azienda: '',
        settore: '',
        partitaIva: '',
        localita: '',
        fatturato: '',
        importoOperazione: '',
        tempistica: '',
        descrizione: '',
        nomeContatto: '',
        email: '',
        telefono: '',
        ruolo: '',
        clienteFinale: '',
        mandatoScritto: '',
        accettaNDA: false,
        haLettoNDA: false,
        accettaCondizioni: false,
        haLettoCondizioni: false,
        accettaPrivacy: false,
    });
    const [scoringConfig, setScoringConfig] = useState<any>(null);

    // FUNZIONE HELPER PER AGGIORNARE I CAMPI
    const updateField = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    // DRAFT SAVING AUTOMATICO - Caricamento
    useEffect(() => {
        const draftKey = `draft_${level}_${draftId || 'new'}`;
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.formData) setFormData(parsed.formData);
                if (parsed.tipoRichiedente) setTipoRichiedente(parsed.tipoRichiedente);
                if (parsed.complessitaProgetto) setComplessitaProgetto(parsed.complessitaProgetto);
            } catch (e) {
                console.error('Errore caricamento draft:', e);
            }
        }
    }, []);

    // DRAFT SAVING AUTOMATICO - Salvataggio
    useEffect(() => {
        const draftKey = `draft_${level}_${draftId || 'new'}`;
        const timeout = setTimeout(() => {
            localStorage.setItem(draftKey, JSON.stringify({
                formData,
                tipoRichiedente,
                complessitaProgetto,
                step
            }));
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 2000);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [formData, tipoRichiedente, complessitaProgetto, step]);

    // PRICING ENGINE L3
    useEffect(() => {
        if (level === 'L3' && formData.importoOperazione) {
            const input: PricingInput = {
                fatturato: formData.fatturato,
                importoOperazione: formData.importoOperazione,
                settore: formData.settore,
                tempistica: formData.tempistica,
                complessita: complessitaProgetto,
            };
            const result = calcolaPrezzoL3(input);
            setStimaL3(result.stimaMin);
            setStimaMaxL3(result.stimaMax);
        }
    }, [level, formData.fatturato, formData.importoOperazione, formData.settore, formData.tempistica, complessitaProgetto]);

    // LEAD SCORING - Calcolo in tempo reale
    useEffect(() => {
        if (formData.email && formData.nomeContatto && scoringConfig) {
            const score = calcolaLeadScore({
                tipoRichiedente,
                fatturato: formData.fatturato,
                settore: formData.settore,
                importoOperazione: formData.importoOperazione,
                ruolo: formData.ruolo,
                email: formData.email,
                mandatoScritto: formData.mandatoScritto,
                nomeContatto: formData.nomeContatto,
                azienda: formData.azienda,
            }, scoringConfig); // Passa la config caricata dal server
            setLeadScore(score);
        }
    }, [formData, tipoRichiedente, scoringConfig]);

    // Carica la configurazione scoring dal server
    useEffect(() => {
        fetch('/api/scoring-config')
            .then(res => res.json())
            .then(data => {
                setScoringConfig(data);
            })
            .catch(err => {
                console.error('Errore caricamento config scoring:', err);
                // ✅ Fallback immediato ai default se l'API non risponde
                import('@/lib/lead-scoring').then(mod => setScoringConfig(mod.DEFAULT_SCORING_CONFIG));
            });
    }, []);
    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1);
        else onComplete(formData);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const formatCurrency = (val: string) => {
        const num = val.replace(/[^0-9]/g, '');
        return num ? `€${parseInt(num).toLocaleString()}` : '';
    };
// Carica la configurazione scoring dal server
useEffect(() => {
  fetch('/api/scoring-config')
    .then(res => res.json())
    .then(setScoringConfig)
    .catch(err => console.error('Errore caricamento config scoring:', err));
}, []);
    return (
        <div className="max-w-4xl mx-auto">
            {/* Draft Saved Indicator */}
            {draftSaved && (
                <div className="fixed top-24 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <Save size={16} />
                    <span className="text-sm font-medium">Bozza salvata automaticamente</span>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Il tuo percorso {level}</span>
                    <span className="text-sm text-gray-500">Step {step} di {totalSteps}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">

                {/* ============ STEP 1: CONFIGURAZIONE ============ */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Configura il tuo percorso</h2>
                            <p className="text-gray-600">Raccontaci chi sei e cosa ti serve</p>
                        </div>

                        {/* Segmentazione Richiedente */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Chi sta facendo la richiesta? *</label>
                            <div className="grid md:grid-cols-3 gap-3">
                                {[
                                    { id: 'azienda', title: 'Sono l\'Azienda', desc: 'Owner, CFO, Direttore Generale' },
                                    { id: 'consulente', title: 'Sono un Consulente', desc: 'Lavoro per conto del cliente' },
                                    { id: 'intermediario', title: 'Sono un Intermediario', desc: 'Advisor, Broker, Family Office' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setTipoRichiedente(opt.id as any)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${tipoRichiedente === opt.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
                                    >
                                        <div className="font-bold text-[#1a2744] mb-1">{opt.title}</div>
                                        <div className="text-xs text-gray-500">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Campi Intermediario */}
                        {tipoRichiedente && tipoRichiedente !== 'azienda' && (
                            <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
                                <h4 className="font-bold text-[#1a2744] flex items-center gap-2">
                                    <Shield size={18} className="text-blue-600" />
                                    Informazioni sul Mandato
                                </h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Cliente Finale</label>
                                        <input
                                            type="text"
                                            value={formData.clienteFinale}
                                            onChange={(e) => updateField('clienteFinale', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            placeholder="Azienda target del progetto"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Hai un mandato scritto?</label>
                                        <select
                                            value={formData.mandatoScritto}
                                            onChange={(e) => updateField('mandatoScritto', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        >
                                            <option value="">Seleziona...</option>
                                            <option value="si">Sì, mandato formale</option>
                                            <option value="verbale">Accordo verbale</option>
                                            <option value="no">No, ma posso ottenerlo</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-blue-100 text-sm text-gray-700">
                                    <strong className="text-blue-700">📌 Fee di collaborazione:</strong> Per consulenti e intermediari qualificati,
                                    prevediamo una fee del <strong>5-15% del nostro compenso</strong>, erogata al closing.
                                </div>
                            </div>
                        )}

                        {/* Dati Aziendali */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ragione Sociale *</label>
                                <input type="text" value={formData.azienda} onChange={(e) => updateField('azienda', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder={tipoRichiedente === 'azienda' ? "La tua azienda" : "Azienda cliente"} />
                            </div>

                            {/* NUOVO: Partita IVA */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA *</label>
                                <input type="text" value={formData.partitaIva} onChange={(e) => updateField('partitaIva', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="IT12345678901" />
                            </div>

                            {/* NUOVO: Settore a Selezione (Match perfetto con lo Scoring) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Settore di Riferimento *</label>
                                <select value={formData.settore} onChange={(e) => updateField('settore', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                    <option value="">Seleziona il settore...</option>
                                    <option value="tech">Tecnologia & Software</option>
                                    <option value="manifatturiero">Manifatturiero & Industria 4.0</option>
                                    <option value="finanza">Finanza & Assicurazioni</option>
                                    <option value="energia">Energia & Sostenibilità</option>
                                    <option value="farmaceutico">Farmaceutico & Biotech</option>
                                    <option value="fintech">Fintech & Pagamenti</option>
                                    <option value="servizi">Servizi & Consulenza</option>
                                    <option value="altro">Altro</option>
                                </select>
                            </div>

                            {/* NUOVO: Località */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Località / Sede *</label>
                                <input type="text" value={formData.localita} onChange={(e) => updateField('localita', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="es. Milano, Roma" />
                            </div>

                            {(level === 'L2' || level === 'L3') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fatturato Annuo</label>
                                    <input type="text" value={formData.fatturato} onChange={(e) => updateField('fatturato', formatCurrency(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="€0" />
                                </div>
                            )}

                            {level === 'L3' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Importo Operazione Stimato</label>
                                        <input type="text" value={formData.importoOperazione} onChange={(e) => updateField('importoOperazione', formatCurrency(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                            placeholder="€0" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tempistiche</label>
                                        <select value={formData.tempistica} onChange={(e) => updateField('tempistica', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                            <option value="">Seleziona...</option>
                                            <option value="immediata">Urgente (&lt; 3 mesi)</option>
                                            <option value="standard">Standard (3-6 mesi)</option>
                                            <option value="lunga">Lungo termine (6+ mesi)</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Complessità Progetto (SOLO L3, DENTRO step 1) */}
                        {level === 'L3' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Complessità del Progetto Richiesto
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'bassa', label: 'Bassa', desc: 'Analisi, report, consulenza base' },
                                        { id: 'media', label: 'Media', desc: 'Piano industriale, financial modeling' },
                                        { id: 'alta', label: 'Alta', desc: 'M&A, ristrutturazione, acquisizioni' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setComplessitaProgetto(opt.id as any)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${complessitaProgetto === opt.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
                                        >
                                            <div className="font-bold text-[#1a2744] mb-1">{opt.label}</div>
                                            <div className="text-xs text-gray-500">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dati Contatto */}
                        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome e Cognome *</label>
                                <input type="text" value={formData.nomeContatto} onChange={(e) => updateField('nomeContatto', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Mario Rossi" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo *</label>
                                <input type="text" value={formData.ruolo} onChange={(e) => updateField('ruolo', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="es. CEO, CFO, Partner" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="mario@azienda.it" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                                <input type="tel" value={formData.telefono} onChange={(e) => updateField('telefono', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="+39 333 1234567" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrivi brevemente il progetto</label>
                            <textarea value={formData.descrizione} onChange={(e) => updateField('descrizione', e.target.value)} rows={4}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                placeholder="Cosa vuoi ottenere? Quali sono le tue esigenze principali?" />
                        </div>

                        {/* Pricing Engine L3 Live */}
                        {level === 'L3' && stimaL3 && stimaMaxL3 && (
                            <div className="bg-gradient-to-br from-[#1a2744] to-[#0f3460] text-white p-6 rounded-xl mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp size={20} className="text-orange-400" />
                                    <span className="text-sm font-medium text-gray-300">Stima Preliminare Investimento</span>
                                </div>
                                <div className="text-3xl font-bold mb-2">
                                    €{stimaL3.toLocaleString()} - €{stimaMaxL3.toLocaleString()}
                                </div>
                                <p className="text-xs text-gray-400 mb-3">
                                    Basato sull'importo dell'operazione richiesta e sulla complessità del progetto.
                                </p>
                                <div className="bg-white/10 rounded-lg p-3 text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Importo operazione:</span>
                                        <span className="font-semibold">{formData.importoOperazione}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Complessità:</span>
                                        <span className="font-semibold capitalize">{complessitaProgetto}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tempistiche:</span>
                                        <span className="font-semibold">{formData.tempistica === 'immediata' ? 'Urgente (+25%)' : 'Standard'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============ STEP 2: NDA (Solo L3) ============ */}
                {step === 2 && level === 'L3' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Accordo di Riservatezza (NDA)</h2>
                            <p className="text-gray-600">
                                Per proteggere le informazioni sensibili che condividerai con noi.
                                Leggi attentamente il documento prima di accettare.
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="bg-[#1a2744] text-white px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} />
                                    <span className="font-semibold">NDA - Progetto Impresa S.r.l.</span>
                                </div>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors">
                                    <Download size={14} /> Scarica PDF
                                </button>
                            </div>
                            <div className="p-6 max-h-96 overflow-y-auto text-sm text-gray-700 space-y-3">
                                <h3 className="font-bold text-[#1a2744] text-base">NON-DISCLOSURE AGREEMENT</h3>
                                <p><strong>Data:</strong> {new Date().toLocaleDateString('it-IT')}</p>
                                <p><strong>Tra:</strong> Progetto Impresa S.r.l. (di seguito "Consulente") e {formData.azienda || '[Ragione Sociale]'} (di seguito "Cliente").</p>
                                <p><strong>1. Oggetto:</strong> Le parti si impegnano a mantenere strettamente riservate tutte le informazioni scambiate nel contesto della presente consulenza.</p>
                                <p><strong>2. Durata:</strong> L'obbligo di riservatezza ha durata di 5 (cinque) anni dalla data di sottoscrizione.</p>
                                <p><strong>3. Eccezioni:</strong> Non sono considerate confidenziali le informazioni già di pubblico dominio.</p>
                                <p><strong>4. Utilizzo:</strong> Le informazioni confidenziali potranno essere utilizzate esclusivamente per valutare e realizzare l'operazione oggetto della consulenza.</p>
                                <p><strong>5. Legge applicabile:</strong> Il presente accordo è regolato dalla legge italiana. Per qualsiasi controversia sarà competente il Foro di Milano.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={formData.haLettoNDA} onChange={(e) => updateField('haLettoNDA', e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                <div>
                                    <span className="font-medium text-[#1a2744] block">Ho letto integralmente il documento NDA</span>
                                    <span className="text-sm text-gray-500">Confermo di aver scaricato e letto il documento completo</span>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={formData.accettaNDA} onChange={(e) => updateField('accettaNDA', e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                <div>
                                    <span className="font-medium text-[#1a2744] block">Accetto i termini dell'NDA</span>
                                    <span className="text-sm text-gray-500">Mi impegno a rispettare gli obblighi di riservatezza</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* ============ STEP CONDIZIONI ============ */}
                {((level === 'L1' && step === 2) || (level === 'L2' && step === 3) || (level === 'L3' && step === 3)) && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Termini, Condizioni e Pagamenti</h2>
                            <p className="text-gray-600">Leggi attentamente prima di procedere. Tutto è trasparente.</p>
                        </div>

                        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
                            <h3 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                <FileText size={18} className="text-orange-600" />
                                Piano di Pagamento {level}
                            </h3>
                            <div className="space-y-3 text-sm">
                                {level === 'L1' && (
                                    <>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Acconto alla firma (50%)</span>
                                            <span className="font-bold text-orange-600">€750</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Saldo alla consegna (50%)</span>
                                            <span className="font-bold text-orange-600">€750</span>
                                        </div>
                                        <p className="text-xs text-gray-600 pt-2">
                                            Consegna in 48h dall'acconto. Il saldo è dovuto alla consegna del Business Plan.
                                        </p>
                                    </>
                                )}
                                {level === 'L2' && (
                                    <>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Acconto alla firma (40%)</span>
                                            <span className="font-bold text-orange-600">€8.000</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Rata 2 - Financial Model (30%)</span>
                                            <span className="font-bold text-orange-600">€6.000</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Saldo finale (30%)</span>
                                            <span className="font-bold text-orange-600">€6.000</span>
                                        </div>
                                        <p className="text-xs text-gray-600 pt-2">
                                            Consegna in 10 giorni. Ogni rata sblocca la fase successiva.
                                        </p>
                                    </>
                                )}
                                {level === 'L3' && stimaL3 && (
                                    <>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">SAL 1 - Firma contratto (20%)</span>
                                            <span className="font-bold text-orange-600">€{Math.round(stimaL3 * 0.2).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">SAL 2 - Audit (15%)</span>
                                            <span className="font-bold text-orange-600">€{Math.round(stimaL3 * 0.15).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-white rounded-lg">
                                            <span className="text-gray-700">Success Fee (10%)</span>
                                            <span className="font-bold text-orange-600">€{Math.round(stimaL3 * 0.1).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 pt-2">
                                            I SAL definitivi verranno configurati dopo la call discovery.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={formData.haLettoCondizioni} onChange={(e) => updateField('haLettoCondizioni', e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                <div>
                                    <span className="font-medium text-[#1a2744] block">Ho letto i Termini e Condizioni di Servizio</span>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={formData.accettaCondizioni} onChange={(e) => updateField('accettaCondizioni', e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                <div>
                                    <span className="font-medium text-[#1a2744] block">Accetto i Termini e Condizioni</span>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={formData.accettaPrivacy} onChange={(e) => updateField('accettaPrivacy', e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500" />
                                <div>
                                    <span className="font-medium text-[#1a2744] block">Accetto la Privacy Policy (GDPR)</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* ============ STEP FINALE ============ */}
                {(step === totalSteps || (level === 'L3' && step === 4)) && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2744] mb-2">
                                {level === 'L3' ? 'Prenota la Call Discovery' : 'Il tuo percorso è pronto'}
                            </h2>
                            <p className="text-gray-600">
                                {level === 'L3'
                                    ? 'Scegli quando fare la call gratuita di 30 minuti'
                                    : 'Riepilogo e piano di pagamento'}
                            </p>
                        </div>

                        {level === 'L3' ? (
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-[#1a2744] to-[#0f3460] text-white p-6 rounded-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Calendar size={24} className="text-orange-400" />
                                        <div>
                                            <div className="font-bold text-lg">Call Discovery Gratuita</div>
                                            <div className="text-sm text-gray-300">30 minuti con il nostro Senior Partner</div>
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400" /> Analisi preliminare del tuo progetto</li>
                                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400" /> Conferma della stima di investimento</li>
                                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400" /> Configurazione SAL personalizzati</li>
                                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400" /> Nessun impegno, zero pressione</li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Scegli il giorno e l'orario</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Lun 15 Lug - 10:00', 'Lun 15 Lug - 15:00', 'Mar 16 Lug - 09:30', 'Mar 16 Lug - 14:00', 'Mer 17 Lug - 11:00', 'Mer 17 Lug - 16:30'].map((slot) => (
                                            <button
                                                key={slot}
                                                onClick={() => setCallSlot(slot)}
                                                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${callSlot === slot ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 hover:border-orange-300'}`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                                    <h3 className="font-bold text-[#1a2744] mb-4">Riepilogo Servizio {level}</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-700">Azienda:</span><span className="font-semibold">{formData.azienda}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-700">Settore:</span><span className="font-semibold">{formData.settore}</span></div>
                                        <div className="border-t border-orange-300 my-3"></div>
                                        {level === 'L1' && (
                                            <>
                                                <div className="flex justify-between text-base"><span className="font-bold text-[#1a2744]">Acconto (50%):</span><span className="font-bold text-orange-600">€750</span></div>
                                                <div className="flex justify-between text-base"><span className="font-bold text-[#1a2744]">Saldo (50%):</span><span className="font-bold text-orange-600">€750</span></div>
                                            </>
                                        )}
                                        {level === 'L2' && (
                                            <>
                                                <div className="flex justify-between text-base"><span className="font-bold text-[#1a2744]">Acconto (40%):</span><span className="font-bold text-orange-600">€8.000</span></div>
                                                <div className="flex justify-between text-base"><span className="font-bold text-[#1a2744]">Rata 2 (30%):</span><span className="font-bold text-orange-600">€6.000</span></div>
                                                <div className="flex justify-between text-base"><span className="font-bold text-[#1a2744]">Saldo (30%):</span><span className="font-bold text-orange-600">€6.000</span></div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-[#1a2744] mb-3">Metodo di Pagamento Acconto</h3>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <button className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-500 bg-blue-50 text-left">
                                            <FileText size={24} className="text-blue-600" />
                                            <div>
                                                <div className="font-bold text-[#1a2744]">Carta di Credito</div>
                                                <div className="text-xs text-gray-500">Pagamento immediato</div>
                                            </div>
                                        </button>
                                        <button className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-left">
                                            <FileText size={24} className="text-orange-600" />
                                            <div>
                                                <div className="font-bold text-[#1a2744]">Bonifico Bancario</div>
                                                <div className="text-xs text-gray-500">Riceverai le coordinate</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    {step > 1 ? (
                        <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">
                            <ArrowLeft size={18} /> Indietro
                        </button>
                    ) : <div />}

                    <button onClick={handleNext}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-bold shadow-lg shadow-blue-900/20 transition-all">
                        {step === totalSteps ? (level === 'L3' ? 'Prenota Call Discovery' : 'Procedi al Pagamento') : 'Avanti'}
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {/* Lead Score Badge (Sempre visibile per test e debug) */}
            {leadScore && (
                <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-4 w-72 animate-in fade-in slide-in-from-bottom-4">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between items-center">
                        <span>🎯 Lead Score</span>
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">LIVE</span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-sm ${leadScore.tier === 'Whale' ? 'bg-red-500 text-white' :
                                leadScore.tier === 'Hot' ? 'bg-orange-500 text-white' :
                                    'bg-gray-200 text-gray-600'
                            }`}>
                            {leadScore.totale}
                        </div>
                        <div>
                            <div className={`font-bold text-lg ${leadScore.tier === 'Whale' ? 'text-red-600' :
                                    leadScore.tier === 'Hot' ? 'text-orange-600' :
                                        'text-gray-600'
                                }`}>
                                {leadScore.tier}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                                A:{leadScore.dettagli.azienda} | R:{leadScore.dettagli.referente} | I:{leadScore.dettagli.intermediario}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-1">Motivazioni:</div>
                        <div className="text-xs text-gray-600 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {leadScore.motivazioni.length > 0 ? (
                                leadScore.motivazioni.map((m: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                        <span className="text-green-500 mt-0.5">✓</span>
                                        <span>{m}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-gray-400 italic py-1">Compila Email e Nome per iniziare il calcolo...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
