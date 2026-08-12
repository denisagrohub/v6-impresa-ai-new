import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Calculator, ShieldCheck, FileCheck2 } from "lucide-react";
import { Button } from "@erpv6/ui";
import KairosMatrix from "@/components/home/KairosMatrix";

export const metadata: Metadata = {
  title: "Il business plan che regge davanti a una banca | V6 Impresa AI",
  description:
    "Costruiamo il modello finanziario, lo mettiamo sotto stress e verifichiamo che il DSCR tenga prima che lo faccia l’istruttore di fido.",
};

const step = [
  {
    n: "01",
    title: "Raccolta dati",
    desc: "Analizziamo l’azienda, i numeri esistenti e l’obiettivo del finanziamento.",
    icon: ClipboardList,
  },
  {
    n: "02",
    title: "Modello finanziario",
    desc: "Costruiamo il piano a 3-5 anni: conto economico, flussi di cassa, DSCR.",
    icon: Calculator,
  },
  {
    n: "03",
    title: "Stress test",
    desc: "Verifichiamo la tenuta del piano negli stessi scenari conservativi che userà la banca.",
    icon: ShieldCheck,
  },
  {
    n: "04",
    title: "Presentazione in banca",
    desc: "Consegniamo il dossier pronto per l’istruttoria, con supporto nella presentazione.",
    icon: FileCheck2,
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] text-stone-900 sm:text-5xl lg:text-6xl">
              Il business plan che regge davanti a una banca.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600 sm:text-xl">
              Costruiamo il modello finanziario, lo mettiamo sotto stress e
              verifichiamo che il DSCR tenga — prima che lo faccia l’istruttore
              di fido.
            </p>

            <div className="mt-8">
              <Link href="/intervista">
                <Button size="lg" className="shadow-lg hover:shadow-xl">
                  Prenota una call gratuita
                  <ArrowRight size={18} className="ml-2" aria-hidden="true" />
                </Button>
              </Link>
            </div>

            <div className="mt-10 inline-flex items-baseline gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
              <span className="font-serif text-3xl font-bold text-orange-600 sm:text-4xl">
                DSCR 3,18x
              </span>
              <span className="text-sm text-stone-600 sm:text-base">
                su un finanziamento ISMEA da 1,4M€
              </span>
            </div>
          </div>

          <div>
            <KairosMatrix />
            <p className="mt-4 text-sm text-stone-500">
              La Matrice di Kairós: il metodo con cui decidiamo cosa affrontare
              per primo nella tua azienda.
            </p>
          </div>
        </div>
      </section>

      {/* COME LAVORIAMO */}
      <section className="border-t border-stone-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-balance font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
            Come lavoriamo
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {step.map((s) => (
              <div key={s.n}>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <s.icon size={20} aria-hidden="true" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-stone-400">
                  Fase {s.n}
                </p>
                <h3 className="mt-1 text-lg font-bold text-stone-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASO REALE */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-balance font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
            Un caso reale
          </h2>
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Finanziamento ottenuto
                </p>
                <p className="mt-2 font-serif text-4xl font-bold text-stone-900">
                  1,4M€
                </p>
                <p className="mt-1 text-sm text-stone-500">Finanziamento ISMEA</p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  DSCR del piano
                </p>
                <p className="mt-2 font-serif text-4xl font-bold text-orange-600">
                  3,18x
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Le banche richiedono in genere un DSCR minimo di 1,2x
                </p>
              </div>
            </div>
            <p className="mt-8 border-t border-stone-100 pt-6 text-base leading-relaxed text-stone-600">
              Un’azienda agricola aveva bisogno di un piano industriale a
              sostegno di un finanziamento ISMEA. Abbiamo costruito il modello
              finanziario e verificato la sua tenuta con uno stress test sugli
              stessi parametri usati in istruttoria: il risultato è un DSCR di
              3,18x, ben al di sopra della soglia minima richiesta, e il
              finanziamento è stato approvato.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="border-t border-stone-200 bg-stone-900 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance font-serif text-3xl font-bold text-white sm:text-4xl">
            Pronto a portare il tuo progetto in banca?
          </h2>
          <p className="mt-4 text-lg text-stone-300">
            Parliamo del tuo progetto in una call gratuita di 30 minuti.
          </p>
          <div className="mt-8">
            <Link href="/intervista">
              <Button size="lg" className="shadow-lg hover:shadow-xl">
                Prenota una call gratuita
                <ArrowRight size={18} className="ml-2" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
