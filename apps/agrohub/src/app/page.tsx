import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button, Card, Badge } from '@erpv6/ui';
import {
  ClipboardCheck,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Search,
  FileCheck2,
  Handshake,
} from 'lucide-react';

const PacChecklist = dynamic(() => import('@/components/PacChecklist'), {
  loading: () => (
    <p className="text-center text-stone-500 py-12">Caricamento checklist…</p>
  ),
});

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-green-50 border-b border-green-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl">
            <Badge className="bg-white text-green-800 border border-green-200 mb-5 px-3 py-1">
              Metodo verificato su casi reali — non teoria PAC
            </Badge>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 leading-tight mb-6">
              Arrivare pronti alla PAC 2028, con un metodo testato su aziende
              agricole vere.
            </h1>
            <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mb-8">
              Niente ipotesi normative da slide. Un percorso verificato caso
              per caso, dalla diagnosi finanziaria all&apos;accesso ai fondi
              ISMEA — con risultati misurabili come un DSCR di 3,18x e un
              finanziamento ISMEA da €1,4M ottenuto da un&apos;azienda cliente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#checklist">
                <Button
                  size="lg"
                  className="bg-brand hover:bg-green-800 focus-visible:ring-brand w-full sm:w-auto"
                >
                  Fai la Checklist di Autovalutazione
                </Button>
              </a>
              <a href="#prenota-call">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-brand text-brand hover:bg-green-50 focus-visible:ring-brand w-full sm:w-auto"
                >
                  Prenota una call
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Prova concreta: caso reale */}
      <section id="metodo" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="section-title">Il metodo, non la teoria</h2>
          <p className="section-subtitle">
            Un percorso in quattro passaggi, applicato e verificato su casi
            reali di aziende agricole del Nord-Est.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-14">
          {[
            {
              icon: Search,
              title: 'Diagnosi',
              text: 'Fotografia della situazione attuale: bilanci, fascicolo aziendale, esposizione debitoria.',
            },
            {
              icon: TrendingUp,
              title: 'Struttura finanziaria',
              text: 'Calcolo e miglioramento del DSCR per rendere l’azienda finanziabile.',
            },
            {
              icon: Landmark,
              title: 'Accesso ai fondi',
              text: 'Impostazione della pratica su misure PAC e strumenti di garanzia come ISMEA.',
            },
            {
              icon: FileCheck2,
              title: 'Validazione',
              text: 'Verifica finale di conformità e tracciabilità prima dell’invio.',
            },
          ].map((step) => (
            <Card key={step.title} hover={false} className="p-6 border-stone-200">
              <step.icon size={22} className="text-green-700 mb-3" aria-hidden="true" />
              <h3 className="font-semibold text-stone-900 mb-1.5">{step.title}</h3>
              <p className="text-sm text-stone-600 leading-relaxed">{step.text}</p>
            </Card>
          ))}
        </div>

        {/* Caso reale */}
        <Card hover={false} className="p-8 md:p-10 border-green-200 bg-white">
          <Badge className="bg-green-100 text-green-800 mb-4">Caso reale</Badge>
          <h3 className="font-heading text-2xl md:text-3xl font-bold text-stone-900 mb-3">
            Tosi Mati
          </h3>
          <p className="text-stone-600 leading-relaxed max-w-2xl mb-8">
            Azienda agricola del Nord-Est, percorso completo di preparazione
            PAC: dalla diagnosi finanziaria alla pratica di finanziamento.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-700 mb-1">
                3,18x
              </div>
              <div className="text-sm text-stone-600">
                DSCR ottenuto — indice di sostenibilità del debito
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-700 mb-1">
                €1,4M
              </div>
              <div className="text-sm text-stone-600">
                Finanziamento ISMEA ottenuto
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Checklist interattiva */}
      <section id="checklist" className="bg-stone-100 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-brand font-medium text-sm mb-3">
              <ClipboardCheck size={18} aria-hidden="true" />
              Checklist di Autovalutazione PAC
            </div>
            <h2 className="section-title">A che punto è la tua azienda?</h2>
            <p className="section-subtitle mx-auto">
              12 domande concrete. Alla fine scopri la tua zona:{' '}
              <span className="text-red-600 font-medium">Rosso</span>,{' '}
              <span className="text-amber-600 font-medium">Giallo</span> o{' '}
              <span className="text-brand font-medium">Verde</span>.
            </p>
          </div>

          <PacChecklist />
        </div>
      </section>

      {/* Prenota una call */}
      <section id="prenota-call" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <Card hover={false} className="p-8 md:p-12 text-center border-stone-200 bg-white max-w-2xl mx-auto">
          <Handshake size={28} className="text-green-700 mx-auto mb-4" aria-hidden="true" />
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-stone-900 mb-3">
            Parliamone in una call di 20 minuti
          </h2>
          <p className="text-stone-600 leading-relaxed mb-8">
            Portiamo il risultato della tua checklist a un confronto diretto:
            cosa fare prima, cosa può aspettare, e se il tuo caso è simile a
            quello di Tosi Mati.
          </p>
          {/*
            TODO prima del lancio pubblico: collegare qui il link reale di
            booking (es. Calendly / Cal.com) o un indirizzo email verificato.
            Esempio: <Link href="https://cal.com/agrohub-italia/20min">
          */}
          <Link href="#">
            <Button
              size="lg"
              className="bg-brand hover:bg-green-800 focus-visible:ring-brand"
            >
              Prenota una call
            </Button>
          </Link>
          <p className="text-xs text-stone-400 mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} aria-hidden="true" />
            Nessun impegno, nessuna vendita in call.
          </p>
        </Card>
      </section>
    </>
  );
}
