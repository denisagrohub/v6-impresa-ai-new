export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 mt-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h3 className="font-heading text-xl font-bold text-white mb-3">
              AgroHub Italia
            </h3>
            <p className="text-sm text-stone-400 max-w-xs">
              Metodo di preparazione alla PAC 2028 verificato su casi reali di
              aziende agricole del Nord-Est.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Sezioni</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#metodo" className="hover:text-white transition-colors">
                  Il metodo
                </a>
              </li>
              <li>
                <a href="#checklist" className="hover:text-white transition-colors">
                  Checklist di autovalutazione
                </a>
              </li>
              <li>
                <a href="#prenota-call" className="hover:text-white transition-colors">
                  Prenota una call
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 mt-10 pt-6 text-xs text-stone-500 space-y-1">
          <p>© {new Date().getFullYear()} AgroHub Italia. Tutti i diritti riservati.</p>
          {/*
            TODO prima del lancio pubblico: inserire qui i dati legali reali
            (P.IVA, sede legale, eventuale ragione sociale). Non inventare
            questi dati — vanno forniti dal titolare dell'attività.
            Esempio: <p>P.IVA 00000000000 — Sede legale: Via ..., Comune (PR)</p>
          */}
        </div>
      </div>
    </footer>
  );
}
