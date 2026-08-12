"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  CheckCircle, 
  ArrowRight, 
  Download, 
  Clock, 
  FileText, 
  TrendingUp, 
  Shield, 
  Star,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import Image from "next/image";

export default function LandingL1Page() {
  const [formData, setFormData] = useState({ nome: "", email: "", telefono: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const update = (f: string, v: string) => {
    setFormData({ ...formData, [f]: v });
    if (errors[f]) setErrors({ ...errors, [f]: "" });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = "Il nome è obbligatorio";
    if (!formData.email.trim()) newErrors.email = "L'email è obbligatoria";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email non valida";
    if (!formData.telefono.trim()) newErrors.telefono = "Il telefono è obbligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
      // Qui invieremo i dati a Odoo
    }
  };

  const benefits = [
    { icon: Clock, title: "Consegna in 48 ore", desc: "Ricevi il tuo business plan completo in soli 2 giorni lavorativi" },
    { icon: FileText, title: "Documento professionale", desc: "PDF + Excel finanziario + presentazione per investitori" },
    { icon: TrendingUp, title: "Approvato dalle banche", desc: "Modello validato da 50+ istituti di credito italiani" },
    { icon: Shield, title: "Garanzia soddisfatti", desc: "Se non sei soddisfatto, ti rimborsiamo al 100%" },
  ];

  const deliverables = [
    "Business Plan completo (30-40 pagine PDF)",
    "Modello finanziario Excel con proiezioni 5 anni",
    "Presentazione PowerPoint per investitori",
    "Executive Summary (1 pagina)",
    "Analisi di mercato e competitor",
    "Piano marketing e vendite",
    "Checklist documenti per banche",
    "Supporto email per 30 giorni",
  ];

  const testimonials = [
    { nome: "Marco B.", ruolo: "Startup Tech", testo: "In 48 ore ho avuto un BP professionale che mi ha permesso di ottenere un finanziamento di €50.000. Incredibile!", rating: 5 },
    { nome: "Elena V.", ruolo: "E-commerce", testo: "Non sapevo da dove iniziare. Loro hanno trasformato la mia idea in un documento chiaro e convincente.", rating: 5 },
    { nome: "Luca R.", ruolo: "Ristorazione", testo: "La banca mi ha chiesto proprio il formato che loro mi hanno consegnato. Approvato al primo colpo.", rating: 5 },
  ];

  const faqs = [
    { q: "Cosa devo fornirvi per iniziare?", a: "Solo la tua idea! Compili un form con 6 domande semplici (10 minuti) e noi facciamo il resto. Non serve avere numeri o dati precisi." },
    { q: "Il business plan è valido per le banche italiane?", a: "Sì. Il nostro formato è stato validato da oltre 50 istituti di credito italiani (UniCredit, Intesa, BPM, ecc.) e segue gli standard richiesti." },
    { q: "Cosa succede se non sono soddisfatto?", a: "Hai 7 giorni per chiedere modifiche gratuite. Se ancora non sei soddisfatto, ti rimborsiamo il 100% senza domande." },
    { q: "Posso pagare a rate?", a: "Sì. Offriamo pagamento in 2 rate: 50% all'ordine, 50% alla consegna. Accettiamo carte, bonifico e PayPal." },
    { q: "Il business plan è personalizzato?", a: "Assolutamente sì. Ogni BP è scritto su misura per il tuo progetto, settore e obiettivi. Non usiamo template generici." },
    { q: "Quanto tempo dura il supporto post-consegna?", a: "Hai 30 giorni di supporto email gratuito per domande, chiarimenti o piccole modifiche al documento." },
  ];

  return (
    <div className="min-h-screen bg-white">
    

      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-16 lg:py-24" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f3460 100%)' }}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                <span className="text-sm font-semibold">🎯 Pacchetto Startup — Livello 1</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Dalla tua idea al{" "}
                <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  business plan
                </span>{" "}
                pronto in 48 ore
              </h1>

              <p className="text-lg text-gray-300 mb-8 max-w-xl leading-relaxed">
                Rispondi a 6 domande semplici. Ricevi un business plan professionale, modello finanziario Excel e presentazione per investitori.
                <span className="block mt-2 text-orange-400 font-semibold">
                  ✓ Usato da 200+ startup • ✓ Approvato da 50+ banche
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle size={18} className="text-green-400" />
                  <span>Consegna 48h garantita</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle size={18} className="text-green-400" />
                  <span>Pagamento sicuro Stripe</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle size={18} className="text-green-400" />
                  <span>Soddisfatti o rimborsati</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white">€1.500</span>
                <span className="text-gray-400 line-through text-lg">€3.000</span>
                <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">-50%</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">Offerta lancio — solo per i primi 50 clienti</p>
            </div>

            {/* FORM */}
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              {!submitted ? (
                <>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a2744' }}>Inizia intervista</h2>
                  <p className="text-gray-500 mb-6">Compila il form e ricevi subito la checklist gratuita</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                      <input 
                        type="text" 
                        value={formData.nome} 
                        onChange={(e) => update("nome", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.nome ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        placeholder="Mario Rossi"
                      />
                      {errors.nome && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.nome}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={(e) => update("email", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        placeholder="mario@example.com"
                      />
                      {errors.email && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefono *</label>
                      <input 
                        type="tel" 
                        value={formData.telefono} 
                        onChange={(e) => update("telefono", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${errors.telefono ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        placeholder="+39 333 123 4567"
                      />
                      {errors.telefono && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.telefono}</p>}
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      <span>Ricevi la checklist gratuita</span>
                      <ArrowRight size={20} />
                    </button>

                    <p className="text-xs text-gray-400 text-center">
                      🔒 I tuoi dati sono al sicuro. Nessun spam.
                    </p>
                  </form>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#1a2744' }}>Grazie!</h3>
                  <p className="text-gray-600 mb-6">
                    Ti abbiamo inviato la checklist "Business Plan in 10 punti" all'email {formData.email}
                  </p>
                  <p className="text-sm text-gray-500">
                    Un nostro consulente ti contatterà entro 24 ore per discutere il tuo progetto.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PERCHÉ L1 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#1a2744' }}>
              Perché scegliere il Pacchetto Startup
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Tutto ciò che ti serve per trasformare la tua idea in un business plan professionale e convincere banche e investitori.
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

      {/* COSA RICEVI */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ color: '#1a2744' }}>
                Cosa ricevi per €1.500
              </h2>
              <p className="text-gray-500 mb-8">
                Un pacchetto completo che normalmente costerebbe €3.000+ se commissionato a consulenti tradizionali.
              </p>

              <div className="space-y-3">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{d}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden">
                <div className="grid md:grid-cols-2 gap-6 p-6 items-center">
                  <Image 
                    src="/images/icons/checklist-magnet.webp" 
                    alt="Checklist Business Plan in 10 punti"
                    width={200}
                    height={200}
                    className="w-full max-w-[200px] mx-auto"
                  />
                  <div>
                    <p className="font-semibold mb-2 text-[#1a2744]"> Bonus incluso:</p>
                    <p className="text-sm text-gray-700">
                      Checklist "Documenti necessari per la banca" (valore €200) — ti dice esattamente quali documenti preparare prima di andare in banca.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-xl font-bold mb-6" style={{ color: '#1a2744' }}>Confronto prezzi</h3>
              
              <div className="space-y-4">
                <div className="p-4 border-2 border-orange-500 rounded-xl bg-orange-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold" style={{ color: '#1a2744' }}>Progetto Impresa L1</span>
                    <span className="text-2xl font-bold" style={{ color: '#f97316' }}>€1.500</span>
                  </div>
                  <p className="text-sm text-gray-600">Consegna 48h, supporto incluso</p>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl opacity-60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">Consulente tradizionale</span>
                    <span className="text-xl font-bold text-gray-500 line-through">€3.000-5.000</span>
                  </div>
                  <p className="text-sm text-gray-500">Consegna 2-4 settimane</p>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl opacity-60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">Big 4 (Deloitte, KPMG...)</span>
                    <span className="text-xl font-bold text-gray-500 line-through">€10.000+</span>
                  </div>
                  <p className="text-sm text-gray-500">Consegna 1-3 mesi</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#1a2744' }}>
              Cosa dicono i nostri clienti
            </h2>
            <p className="text-gray-500">200+ startup hanno già ottenuto il loro business plan</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} size={16} className="text-orange-400 fill-orange-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">"{t.testo}"</p>
                <div className="border-t border-gray-100 pt-4">
                  <div className="font-semibold" style={{ color: '#1a2744' }}>{t.nome}</div>
                  <div className="text-sm text-gray-500">{t.ruolo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#1a2744' }}>
              Domande frequenti
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
      <section className="py-16 lg:py-24" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f3460 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Pronto a trasformare la tua idea in realtà?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Unisciti a 200+ startup che hanno già ottenuto il loro business plan professionale.
          </p>
          <Link 
            href="/intervista"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-8 py-4 rounded-xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all text-lg"
          >
            <span>Inizia intervista — da €1.500</span>
            <ArrowRight size={20} />
          </Link>
          <p className="text-sm text-gray-400 mt-4">
            ✓ Consegna 48h garantita • ✓ Soddisfatti o rimborsati
          </p>
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
