"use client";
// Overlay blur SOLO per le opportunita. VIETATO su criticita e azioni_urgenti.
// La prima riga di ogni opportunita deve restare visibile per intero.
export default function BlurLock(props: { onUnlock: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-transparent via-[#F7F3ED]/60 to-[#F7F3ED]">
      <p className="text-balance text-center text-sm text-[#1C2128]">
        L&rsquo;analisi completa include tutte le opportunit&agrave; dettagliate.
      </p>
      {/* TODO(payment): collegare al Payment Link Stripe reale */}
      <button
        onClick={props.onUnlock}
        className="rounded-sm bg-[#D4703A] px-5 py-2.5 font-semibold text-[#F8F6F2] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4703A]"
      >
        Sblocca l&rsquo;analisi completa &mdash; 49&euro;
      </button>
    </div>
  );
}
