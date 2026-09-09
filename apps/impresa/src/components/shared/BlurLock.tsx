"use client";
// Overlay blur SOLO per le opportunita. VIETATO su criticita e azioni_urgenti.
// La prima riga di ogni opportunita deve restare visibile per intero.
//
// 06/09/2026: sostituita la toppa a tinta piena col vero effetto
// "documento riservato" - righe di testo REALE (passate da chi chiama,
// mai lorem ipsum) sfocate con un filtro CSS, non nascoste dietro un
// blocco di colore. Feedback diretto ricevuto: "non vedo elementi
// sfocati, vedo toppe color crema, non lettere sfuocate" - il brand si
// posiziona come eccellenza nella produzione di documenti per aziende,
// quindi il teaser deve somigliare a un'anteprima vera (come un
// visualizzatore PDF con le righe oscurate), non a un lucchetto generico.
//
// casoVuoto: quando il caso non ha diagnosi/criticita/azioni_urgenti
// (nessun dato finanziario raccolto), vendere un'analisi a pagamento non
// ha senso - la CTA diventa "prenota una chiamata", non "sblocca a 49€".
interface BlurLockProps {
  // 09/09/2026 (pagamento reale, audit "Punto Zero"): PRIMA sbloccava
  // subito lato client (zero pagamento) - ora avvia davvero il pagamento
  // (redirect verso il sale.order Odoo), il contenuto si sblocca solo al
  // ricarico della pagina con is_paid=true da Odoo.
  onUnlock: () => void;
  unlocking?: boolean;
  unlockError?: string | null;
  previewLines?: string[];
  casoVuoto?: boolean;
  // 06/09/2026: link reale al consulente assegnato (aeosv6_booking),
  // risolto lato Motore dalla regola di assegnazione automatica gia'
  // esistente - fallback a /contatti se non c'e' un consulente risolto,
  // mai un link fisso indovinato qui dentro.
  bookingHref?: string;
}

export default function BlurLock({
  onUnlock,
  unlocking = false,
  unlockError = null,
  previewLines = [],
  casoVuoto = false,
  bookingHref = '/contatti',
}: BlurLockProps) {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      {/* Righe di documento reale, sfocate - danno la sensazione di
          sostanza dietro il velo, non un riquadro vuoto */}
      <div aria-hidden="true" className="select-none pointer-events-none px-1 pt-1">
        {previewLines.map((line, i) => (
          <p
            key={i}
            className="text-base font-medium leading-relaxed text-[#1C2128] mb-3"
            style={{
              filter: 'blur(3px)',
              opacity: 0.92 - i * 0.04,
              width: `${94 - i * 6}%`,
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-b from-transparent via-[#F7F3ED]/20 to-[#F7F3ED]/95 pb-6 pt-24">
        <p className="text-balance text-center text-sm text-[#1C2128] max-w-xs">
          {casoVuoto
            ? "Con i dati raccolti finora non possiamo darti un'analisi completa — parliamone direttamente."
            : "L'analisi completa include tutte le opportunità dettagliate."}
        </p>
        {casoVuoto ? (
          <a
            href={bookingHref}
            className="rounded-sm bg-[#0F1E3C] px-5 py-2.5 font-semibold text-[#F8F6F2] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F1E3C]"
          >
            Prenota una chiamata con un consulente
          </a>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {unlockError && (
              <p className="max-w-xs text-center text-xs text-red-600">{unlockError}</p>
            )}
            <button
              onClick={onUnlock}
              disabled={unlocking}
              className="rounded-sm bg-[#D4703A] px-5 py-2.5 font-semibold text-[#F8F6F2] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4703A] disabled:opacity-60"
            >
              {unlocking ? 'Reindirizzamento al pagamento…' : 'Sblocca l’analisi completa — 49€'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
