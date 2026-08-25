"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  CheckCircle, ArrowRight, AlertCircle, ChevronDown, ChevronUp, 
  TrendingUp, Target, Users, Shield, FileText, BarChart3, Star
} from "lucide-react";

export default function LandingL2Page() {
  const [formData, setFormData] = useState({ azienda: "", email: "", fatturato: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const update = (f: string, v: string) => {
    setFormData({ ...formData, [f]: v });
    if (errors[f]) setErrors({ ...errors, [f]: "" });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.azienda.trim()) newErrors.azienda = "Il nome azienda è obbligatorio";
    if (!formData.email.trim()) newErrors.email = "L'email è obbligatoria";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email non valida";
    if (!formData.fatturato) newErrors.fatturato = "Seleziona la fascia di fatturato";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setSubmitted(true);
  };

  const benefits = [
    { icon: BarChart3, title: "Piano Industriale 3-5 Anni", desc: "Proiezioni finanziarie dettagliate, conto economico, stato patrimoniale e flussi di cassa." },
    { icon: Target, title: "Analisi SWOT e Competitor", desc: "Mappatura approfondita del mercato, posizionamento strategico e barriere all'ingresso." },
    { icon: Users, title: "Pitch Deck per Investitori", desc: "Presentazione professionale da 15 slide ottimizzata per Business Angels e Venture Capital." },
    { icon: Shield, title: "Due Diligence Ready", desc: "Documentazione strutturata per superare i controlli di banche e fondi di investimento." },
  ];

  const deliverables = [
    "Business Plan Strategico (50-80 pagine)",
    "Modello Finanziario Excel dinamico (3-5 anni)",
    "Pitch Deck Investitori (PDF + PowerPoint)",
    "Analisi di Mercato e Benchmarking Competitor",
    "Piano Operativo e Organizzativo",
    "Executive Summary per banche/investitori",
    "Sessione di consulenza strategica (2 ore)",
    "Revisione illimitata per 15 giorni",
  ];

  const faqs = [
    { q: "A chi si rivolge il Pacchetto PMI?", a: "Ad aziende con fatturato tra 1M€ e 10M€ che necessitano di strutturazione per crescita, passaggio generazionale, ricerca di finanziamenti o ingresso di soci." },
    { q: "Qual è la differenza con il Pacchetto Startup (L1)?", a: "L1 è per chi parte da zero (idea). L2 è per chi ha già un'azienda operativa e necessita di analisi finanziarie complesse, piano industriale e strategie di scaling." },
    { q: "Come avviene il lavoro?", a: "Fase 1: Audit e raccolta dati (2 giorni). Fase 2: Analisi e stesura (5 giorni). Fase 3: Revisione congiunta e consegna finale (3 giorni). Totale: 10 giorni lavorativi." },
    { q: "È incluso il supporto per la presentazione in banca?", a: "Sì. Oltre al documento, forniamo una sessione di coaching per prepararti all'incontro con l'istituto di credito o con gli investitori." },
  ];

  return (
    <div className="min-h-screen bg-white">
      

      {/* HERO SECTION L2 */}
      <section className="relative overflow-hidden py-20 lg:py-28" style={{ background: 'linear-gradient(135deg, #0f3460 0%, #1a2744 100%)' }}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                <span className="text-sm font-semibold"> Pacchetto PMI — Livello 2</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Il Business Plan per{" "}
                <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  aziende che vogliono scalare
                </span>
              </h1>

              <p className="text-lg text-gray-300 mb-8 max-w-xl leading-relaxed">
                Piano industriale, analisi finanziaria avanzata e Pitch Deck per investitori. 
                Trasforma la tua PMI in una struttura pronta per la crescita o per la raccolta capitali.
              </p>

              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-5xl font-bold text-white">€20.000</span>
                <span className="text-gray-400 text-lg">IVA esclusa</span>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle size={18} className="text-green-400" />
                  <span>Consegna in 10 giorni</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle size={18} className="text-green-400" />
                  <span>Consulenza strategica inclusa</span>
                </div>
              </div>
            </div>

            {/* FORM L2 */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 border-t-4" style={{ borderColor: '#f97316' }}>
              {!submitted ? (
                <>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a2744' }}>Richiedi l'Audit Gratuito</h2>
                  <p className="text-gray-500 mb-6">Scopri se la tua azienda è pronta per scalare. Rispondiamo entro 24h.</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Azienda *</label>
                      <input 
                        type="text" value={formData.azienda} onChange={(e) => update("azienda", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.azienda ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        placeholder="La tua Azienda S.r.l."
                      />
                      {errors.azienda && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.azienda}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Aziendale *</label>
                      <input 
                        type="email" value={formData.email} onChange={(e) => update("email", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        placeholder="nome@azienda.it"
                      />
                      {errors.email && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fatturato Annuo *</label>
                      <select 
                        value={formData.fatturato} onChange={(e) => update("fatturato", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.fatturato ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white`}
                      >
                        <option value="">Seleziona...</option>
                        <option value="<1M">Meno di 1M€</option>
                        <option value="1M-5M">1M€ - 5M€</option>
                        <option value="5M-10M">5M€ - 10M€</option>
                        <option value=">10M">Oltre 10M€</option>
                      </select>
                      {errors.fatturato && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.fatturato}</p>}
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      <span>Richiedi Audit Gratuito</span>
                      <ArrowRight size={20} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#1a2744' }}>Richiesta Ricevuta!</h3>
                  <p className="text-gray-600">
                    Un nostro consulente senior analizzerà la tua azienda e ti contatterà entro 24 ore per fissare l'audit.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PERCHÉ L2 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#1a2744' }}>
              Perché le PMI scelgono il Livello 2
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Non è un semplice documento. È uno strumento strategico per prendere decisioni, ottenere finanziamenti e attrarre investitori.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="card text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f9731620' }}>
                  <b.icon size={24} style={{ color: '#f97316' }} />
                </div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERABLES E CONFRONTO */}
      <section className="py-20" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ color: '#1a2744' }}>
                Cosa include il Pacchetto PMI
              </h2>
              <div className="space-y-4">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 font-medium">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 sticky top-24">
              <h3 className="text-xl font-bold mb-6" style={{ color: '#1a2744' }}>Il nostro metodo di lavoro</h3>
              
              <div className="space-y-6">
                {[
                  { n: 1, t: "Audit e Raccolta Dati", d: "Analizziamo bilanci, processi e obiettivi. 2 giorni." },
                  { n: 2, t: "Sviluppo Strategico", d: "Creazione piano industriale e modello finanziario. 5 giorni." },
                  { n: 3, t: "Revisione Congiunta", d: "Presentazione bozza e allineamento con il management. 1 giorno." },
                  { n: 4, t: "Consegna e Coaching", d: "Documenti finali e sessione di preparazione meeting. 2 giorni." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white" style={{ backgroundColor: '#f97316' }}>
                      {step.n}
                    </div>
                    <div>
                      <h4 className="font-bold" style={{ color: '#1a2744' }}>{step.t}</h4>
                      <p className="text-sm text-gray-500">{step.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#1a2744' }}>
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
                  <div className="px-6 pb-6 text-gray-600">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f3460 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            La tua azienda merita una strategia, non solo un documento.
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Fai l'analisi gratuita e scopri il potenziale inespresso del tuo business.
          </p>
          <Link 
            href="/intervista"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-8 py-4 rounded-xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all text-lg"
          >
            <span>Inizia intervista L2</span>
            <ArrowRight size={20} />
          </Link>
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
