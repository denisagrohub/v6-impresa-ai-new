"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, AlertCircle, ChevronDown, ChevronUp, 
  Landmark, Briefcase, ShieldCheck, TrendingUp, FileText, Lock, 
  Check, ChevronRight, Building2, Target, Calendar
} from "lucide-react";

export default function LandingL3Page() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    // Step 1: Profilo Aziendale
    ragioneSociale: "",
    fatturato: "",
    ebitda: "",
    settore: "",
    // Step 2: L'Operazione
    tipologia: [] as string[],
    importo: "",
    tempistiche: "",
    // Step 3: Contatto
    nome: "",
    ruolo: "",
    email: "",
    nda: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const toggleTipologia = (val: string) => {
    setFormData(prev => ({
      ...prev,
      tipologia: prev.tipologia.includes(val) 
        ? prev.tipologia.filter(t => t !== val)
        : [...prev.tipologia, val]
    }));
    if (errors.tipologia) setErrors(prev => ({ ...prev, tipologia: "" }));
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.ragioneSociale.trim()) newErrors.ragioneSociale = "Obbligatorio";
      if (!formData.fatturato) newErrors.fatturato = "Seleziona una fascia";
      if (!formData.ebitda) newErrors.ebitda = "Seleziona un margine";
      if (!formData.settore.trim()) newErrors.settore = "Obbligatorio";
    } else if (step === 2) {
      if (formData.tipologia.length === 0) newErrors.tipologia = "Seleziona almeno un'opzione";
      if (!formData.importo) newErrors.importo = "Seleziona una fascia";
      if (!formData.tempistiche) newErrors.tempistiche = "Seleziona una tempistica";
    } else if (step === 3) {
      if (!formData.nome.trim()) newErrors.nome = "Obbligatorio";
      if (!formData.ruolo) newErrors.ruolo = "Seleziona il ruolo";
      if (!formData.email.trim()) newErrors.email = "Obbligatorio";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email non valida";
      if (!formData.nda) newErrors.nda = "Devi accettare per procedere";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (step < 3) setStep(step + 1);
      else setSubmitted(true);
    }
  };

  const benefits = [
    { icon: Landmark, title: "Bankability Istituzionale", desc: "Documentazione strutturata secondo gli standard delle principali banche d'affari e fondi di private equity." },
    { icon: TrendingUp, title: "Financial Modeling Avanzato", desc: "Modelli DCF, LBO e proiezioni scenari (Base, Upside, Downside) per valutare la solidità dell'operazione." },
    { icon: Briefcase, title: "Supporto M&A e Roadshow", desc: "Affiancamento nelle trattative, preparazione alla Data Room e supporto durante gli incontri con gli investitori." },
    { icon: Lock, title: "Massima Riservatezza", desc: "Gestione del processo sotto NDA. Anonimato garantito nelle fasi iniziali di contatto con il mercato." },
  ];

  const deliverables = [
    "Information Memorandum (IM) completo e Teaser anonimo",
    "Financial Model dinamico e auditabile (Excel)",
    "Business Plan Strategico-Operativo (80+ pagine)",
    "Supporto alla predisposizione della Virtual Data Room",
    "Analisi di settore e benchmarking transazioni comparabili",
    "Sessioni di strategia finanziaria con il management",
    "Affiancamento durante il roadshow con investitori/banche",
    "Reportistica mensile di avanzamento dell'operazione",
  ];

  const faqs = [
    { q: "Qual è il perimetro di intervento del Livello 3?", a: "Operazioni di Project Finance, ristrutturazioni debitorie, passaggi generazionali complessi, M&A e raccolte capitali superiori a 5M€. Il team è composto da senior advisor con esperienza in banche d'affari." },
    { q: "Come viene gestita la riservatezza dei dati?", a: "Tutto il processo è coperto da NDA (Non-Disclosure Agreement) firmato prima dell'avvio. Utilizziamo piattaforme sicure per la Data Room e gestiamo i contatti con il mercato in forma anonima tramite Teaser." },
    { q: "Quali sono le tempistiche di un'operazione L3?", a: "Le tempistiche dipendono dalla complessità dell'operazione. La fase di strutturazione e modellizzazione richiede dai 30 ai 60 giorni. Il processo di placement/finanziamento può durare dai 3 ai 9 mesi." },
    { q: "È prevista una success fee?", a: "La struttura standard prevede un fixed fee per la strutturazione dell'operazione e una success fee calcolata sulla percentuale di capitale raccolto o sul valore dell'operazione chiusa con successo." },
  ];

  return (
    <div className="min-h-screen bg-white">
      

      {/* HERO SECTION L3 */}
      <section className="relative overflow-hidden py-24 lg:py-32" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 mb-6">
                <Lock size={14} className="text-orange-400" />
                <span className="text-sm font-semibold text-gray-300">Advisory & Project Finance — Livello 3</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
                Structuring & Advisory per{" "}
                <span className="text-orange-500">operazioni complesse</span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                Financial modeling avanzato, Information Memorandum e supporto alla raccolta capitali. 
                Affianchiamo il management in operazioni di M&A, Project Finance e ristrutturazioni.
              </p>

              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-sm text-gray-500 uppercase tracking-wider">Investimento</span>
                <span className="text-3xl font-bold text-white ml-2">A partire da €150.000</span>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm mb-8">
                <div className="flex items-center gap-2 text-gray-400">
                  <ShieldCheck size={18} className="text-orange-400" />
                  <span>Team di Senior Advisor</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <ShieldCheck size={18} className="text-orange-400" />
                  <span>Processo sotto NDA</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <ShieldCheck size={18} className="text-orange-400" />
                  <span>Success fee opzionale</span>
                </div>
              </div>
            </div>

            {/* FORM L3 HIGH-TICKET */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4" style={{ borderColor: '#f97316' }}>
              {!submitted ? (
                <div className="p-8">
                  {/* Header Form */}
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a2744' }}>
                      {step === 1 && "Profilo Aziendale"}
                      {step === 2 && "L'Operazione"}
                      {step === 3 && "Contatto & Riservatezza"}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {step === 1 && "Informazioni essenziali per valutare la fattibilità."}
                      {step === 2 && "Descrivi l'operazione che hai in mente."}
                      {step === 3 && "I tuoi dati saranno trattati in massima riservatezza."}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="flex-1">
                        <div className={`h-1 rounded-full transition-all ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
                      </div>
                    ))}
                  </div>

                  {/* STEP 1: Profilo Aziendale */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ragione Sociale *</label>
                        <div className="relative">
                          <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" value={formData.ragioneSociale} onChange={(e) => updateField("ragioneSociale", e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.ragioneSociale ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                            placeholder="Azienda S.p.A."
                          />
                        </div>
                        {errors.ragioneSociale && <p className="mt-1 text-xs text-red-600">{errors.ragioneSociale}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fatturato Annuo *</label>
                          <select 
                            value={formData.fatturato} onChange={(e) => updateField("fatturato", e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.fatturato ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white`}
                          >
                            <option value="">Seleziona...</option>
                            <option value="<5M">Meno di 5M€</option>
                            <option value="5-20M">5M€ - 20M€</option>
                            <option value="20-50M">20M€ - 50M€</option>
                            <option value=">50M">Oltre 50M€</option>
                          </select>
                          {errors.fatturato && <p className="mt-1 text-xs text-red-600">{errors.fatturato}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">EBITDA Margin *</label>
                          <select 
                            value={formData.ebitda} onChange={(e) => updateField("ebitda", e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.ebitda ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white`}
                          >
                            <option value="">Seleziona...</option>
                            <option value="negativo">Negativo</option>
                            <option value="0-10%">0 - 10%</option>
                            <option value="10-20%">10 - 20%</option>
                            <option value=">20%">Oltre 20%</option>
                          </select>
                          {errors.ebitda && <p className="mt-1 text-xs text-red-600">{errors.ebitda}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Settore di appartenenza *</label>
                        <input 
                          type="text" value={formData.settore} onChange={(e) => updateField("settore", e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border ${errors.settore ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                          placeholder="es. Manifatturiero, Agroalimentare, Tech..."
                        />
                        {errors.settore && <p className="mt-1 text-xs text-red-600">{errors.settore}</p>}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: L'Operazione */}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipologia di Intervento *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {["Raccolta Capitali (Equity)", "Finanziamento / Project Finance", "Ristrutturazione Debito", "M&A (Acquisizione/Vendita)", "Passaggio Generazionale", "Altro"].map((opt) => (
                            <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              formData.tipologia.includes(opt) ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}>
                              <input 
                                type="checkbox" 
                                checked={formData.tipologia.includes(opt)}
                                onChange={() => toggleTipologia(opt)}
                                className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                              />
                              <span className="text-sm text-gray-700">{opt}</span>
                            </label>
                          ))}
                        </div>
                        {errors.tipologia && <p className="mt-1 text-xs text-red-600">{errors.tipologia}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Importo Stimato dell'Operazione *</label>
                        <select 
                          value={formData.importo} onChange={(e) => updateField("importo", e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border ${errors.importo ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white`}
                        >
                          <option value="">Seleziona...</option>
                          <option value="<5M">Meno di 5M€</option>
                          <option value="5-10M">5M€ - 10M€</option>
                          <option value="10-50M">10M€ - 50M€</option>
                          <option value=">50M">Oltre 50M€</option>
                        </select>
                        {errors.importo && <p className="mt-1 text-xs text-red-600">{errors.importo}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tempistiche Previste *</label>
                        <div className="relative">
                          <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <select 
                            value={formData.tempistiche} onChange={(e) => updateField("tempistiche", e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.tempistiche ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white appearance-none`}
                          >
                            <option value="">Seleziona...</option>
                            <option value="immediata">Immediata (entro 3 mesi)</option>
                            <option value="3-6mesi">3 - 6 mesi</option>
                            <option value="6-12mesi">6 - 12 mesi</option>
                            <option value="esplorativa">Fase esplorativa</option>
                          </select>
                        </div>
                        {errors.tempistiche && <p className="mt-1 text-xs text-red-600">{errors.tempistiche}</p>}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Contatto & NDA */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome e Cognome *</label>
                          <input 
                            type="text" value={formData.nome} onChange={(e) => updateField("nome", e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.nome ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                            placeholder="Mario Rossi"
                          />
                          {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruolo *</label>
                          <select 
                            value={formData.ruolo} onChange={(e) => updateField("ruolo", e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.ruolo ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white`}
                          >
                            <option value="">Seleziona...</option>
                            <option value="CEO">CEO / Amministratore Delegato</option>
                            <option value="CFO">CFO / Direttore Finanziario</option>
                            <option value="Owner">Owner / Socio di maggioranza</option>
                            <option value="Advisor">Advisor / Consulente</option>
                            <option value="altro">Altro</option>
                          </select>
                          {errors.ruolo && <p className="mt-1 text-xs text-red-600">{errors.ruolo}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Aziendale *</label>
                        <input 
                          type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                          placeholder="nome.cognome@azienda.it"
                        />
                        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                        <p className="mt-1 text-xs text-gray-400">Si consiglia email aziendale, non personale.</p>
                      </div>

                      <div className="pt-2">
                        <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          formData.nda ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input 
                            type="checkbox" 
                            checked={formData.nda}
                            onChange={(e) => updateField("nda", e.target.checked)}
                            className="w-4 h-4 mt-0.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700 block">Accettazione Riservatezza (NDA)</span>
                            <span className="text-xs text-gray-500">
                              I dati inseriti saranno trattati in massima riservatezza ai fini di una prima valutazione di fattibilità.
                            </span>
                          </div>
                        </label>
                        {errors.nda && <p className="mt-1 text-xs text-red-600">{errors.nda}</p>}
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    {step > 1 ? (
                      <button 
                        onClick={() => setStep(step - 1)}
                        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        ← Indietro
                      </button>
                    ) : <div />}
                    
                    <button 
                      onClick={handleNext}
                      className="flex items-center gap-2 bg-[#1a2744] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0f3460] transition-all"
                    >
                      {step === 3 ? "Invia Richiesta Riservata" : "Avanti"}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 px-8">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1a2744' }}>Richiesta Ricevuta</h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-8">
                    Un Senior Partner esaminerà la tua richiesta e ti contatterà personalmente entro 24 ore per fissare un primo incontro riservato.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm text-gray-600">
                    <Lock size={14} /> Rif. Pratica: #PI-2026-{Math.floor(Math.random() * 9000 + 1000)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PERCHÉ L3 */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight" style={{ color: '#1a2744' }}>
              Advisory di livello istituzionale
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Non forniamo solo documenti. Costruiamo la narrativa finanziaria e strategica per chiudere operazioni complesse con banche, fondi e investitori industriali.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="card text-center border-t-4" style={{ borderTopColor: '#f97316' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-gray-50">
                  <b.icon size={24} style={{ color: '#1a2744' }} />
                </div>
                <h3 className="font-semibold mb-2 text-lg">{b.title}</h3>
                <p className="text-sm text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERABLES E PROCESSO */}
      <section className="py-24" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 tracking-tight" style={{ color: '#1a2744' }}>
                Deliverables dell'operazione
              </h2>
              <div className="space-y-4">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <FileText size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 font-medium">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 sticky top-24">
              <h3 className="text-xl font-bold mb-6 tracking-tight" style={{ color: '#1a2744' }}>Il nostro processo di ingaggio</h3>
              
              <div className="space-y-6">
                {[
                  { n: 1, t: "NDA e Preliminary Assessment", d: "Firma dell'accordo di riservatezza e analisi preliminare della fattabilità dell'operazione." },
                  { n: 2, t: "Data Collection & Modeling", d: "Raccolta dati, due diligence interna e costruzione del Financial Model avanzato." },
                  { n: 3, t: "Strutturazione Documentale", d: "Redazione di Teaser, IM e Business Plan. Preparazione della Data Room." },
                  { n: 4, t: "Market Sounding & Roadshow", d: "Contatto con il mercato (anonimo o palese) e affiancamento nelle negoziazioni." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm" style={{ backgroundColor: '#1a2744' }}>
                      {step.n}
                    </div>
                    <div>
                      <h4 className="font-bold" style={{ color: '#1a2744' }}>{step.t}</h4>
                      <p className="text-sm text-gray-500 mt-1">{step.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight" style={{ color: '#1a2744' }}>
              Domande Frequenti
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold" style={{ color: '#1a2744' }}>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f172a 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            Le operazioni complesse richiedono partner competenti.
          </h2>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
            Valutiamo insieme la tua operazione. Il primo incontro di assessment è riservato e senza impegno.
          </p>
          <button 
            onClick={() => {
              setStep(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-8 py-4 rounded-xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all text-lg"
          >
            <Lock size={20} />
            <span>Richiedi Assessment Riservato</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400">
          © 2026 Progetto Impresa. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
