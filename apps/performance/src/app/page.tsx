import { Badge, Card, cn } from '@erpv6/ui';
import { Logo } from '@/components/Logo';
import { VerticalSwitcher } from '@/components/VerticalSwitcher';
import { RequestForm } from '@/components/RequestForm';

// buttonVariants from @erpv6/ui lives in a 'use client' module, so it can't be
// called directly from this server component — the button look is replicated here.
const LINK_BUTTON_BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98]';

const VALUE_PROPS = [
  {
    title: 'Un motore, non un catalogo di funzioni',
    body: 'Sotto ogni versione c’è lo stesso motore gestionale. Cambiano i moduli, i campi e i flussi in base al mestiere, non la logica di base.',
  },
  {
    title: 'Costruito insieme a chi lo usa',
    body: 'I moduli nascono guardando il lavoro reale di un’officina o di una tipografia, non da un elenco di funzionalità pensate a tavolino.',
  },
  {
    title: 'Niente che non ti serve',
    body: 'Nessun modulo per la produzione su larga scala se hai una bottega. L’obiettivo è restare semplice, non aggiungere tutto quello che un ERP potrebbe fare.',
  },
];

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <a
            href="#richiedi"
            className={cn(
              LINK_BUTTON_BASE,
              'border border-sky-700 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50'
            )}
          >
            Richiedi accesso
          </a>
        </div>
      </header>

      <main id="contenuto">
        {/* HERO */}
        <section className="bg-sky-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="info" className="bg-sky-100 text-sky-800">
                In costruzione — primi partner reali
              </Badge>
              <h1 className="mt-5 text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
                Un motore gestionale che si adatta al tuo settore.
              </h1>
              <p className="mt-5 text-lg text-gray-700 sm:text-xl">
                erpv6 nasce per le botteghe e le imprese verticali: carrozzerie, tipografie,
                falegnamerie. Invece di un ERP generico da capire per mesi, un motore che si
                configura sui campi e sui flussi del tuo mestiere.
              </p>
              <p className="mt-4 text-base text-gray-600">
                Il progetto è in costruzione: stiamo lavorando fianco a fianco con i primi
                partner reali — una carrozzeria e una tipografia — per costruire i moduli sul
                campo, prima di aprirlo ad altri settori.
              </p>
              <div className="mt-8">
                <a
                  href="#richiedi"
                  className={cn(
                    LINK_BUTTON_BASE,
                    'px-6 py-3 text-lg text-white shadow-md hover:shadow-lg bg-sky-700 hover:bg-sky-800'
                  )}
                >
                  Richiedi di essere tra i primi a provarlo nel tuo settore
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* COME FUNZIONA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">Come funziona</h2>
          <p className="mt-3 max-w-2xl text-gray-600">
            L&rsquo;idea di base è semplice: lo stesso motore, adattato a chi lo usa davvero.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {VALUE_PROPS.map((item) => (
              <Card
                key={item.title}
                variant="default"
                hover
                className="border-sky-100 hover:border-sky-300"
              >
                <h3 className="font-sans text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* VERTICAL SWITCHER */}
        <section className="bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900">Il motore visto dal tuo settore</h2>
            <p className="mt-3 max-w-2xl text-gray-600">
              Una visione di come i moduli potrebbero prendere forma, settore per settore.
              Non è ancora il prodotto live: è la direzione su cui stiamo lavorando.
            </p>
            <div className="mt-10">
              <VerticalSwitcher />
            </div>
          </div>
        </section>

        {/* A CHE PUNTO SIAMO */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-gray-900">A che punto siamo</h2>
            <ul className="mt-6 space-y-4 text-gray-700">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                <span>
                  Il sistema è in costruzione: non è ancora un prodotto finito né una soluzione
                  pronta per tutti i settori.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                <span>
                  Stiamo testando i primi moduli con 2 partner reali: una carrozzeria e una
                  tipografia.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                <span>
                  La falegnameria, come altri settori, è per ora una direzione che vogliamo
                  esplorare: non è ancora attiva con un partner.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* RICHIEDI ACCESSO */}
        <section id="richiedi" className="scroll-mt-20 bg-sky-900">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 className="text-3xl font-bold text-white">
              Richiedi di essere tra i primi a provarlo
            </h2>
            <p className="mt-3 text-sky-100">
              Raccontaci qualcosa sulla tua attività: ti risponderemo per capire insieme se il
              tuo settore può entrare tra i prossimi partner del progetto.
            </p>
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl sm:p-8">
              <RequestForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Logo />
          {/*
            TODO: dati legali da inserire quando disponibili
            (ragione sociale, P.IVA, sede legale, PEC, iscrizione registro imprese).
          */}
        </div>
      </footer>
    </>
  );
}
