type Quadrant = {
  eyebrow: string;
  title: string;
  desc: string;
  accent?: boolean;
};

const quadrants: [Quadrant, Quadrant, Quadrant, Quadrant] = [
  {
    eyebrow: "Impatto alto · Prontezza bassa",
    title: "Prepara le condizioni",
    desc: "Pesa molto, ma l’azienda non è ancora pronta ad affrontarlo.",
  },
  {
    eyebrow: "Impatto alto · Prontezza alta",
    title: "Kairós Autentico",
    desc: "Il momento giusto: impatto alto e organizzazione pronta ad agire.",
    accent: true,
  },
  {
    eyebrow: "Impatto basso · Prontezza bassa",
    title: "Non prioritario",
    desc: "Né urgente né determinante. Si registra e si rivaluta più avanti.",
  },
  {
    eyebrow: "Impatto basso · Prontezza alta",
    title: "Quick Win",
    desc: "Risultato rapido e visibile, utile per costruire fiducia.",
  },
];

export default function KairosMatrix() {
  return (
    <figure className="w-full">
      <div className="flex items-stretch gap-2 sm:gap-3">
        <span
          aria-hidden="true"
          className="hidden shrink-0 items-center justify-center text-xs font-medium uppercase tracking-widest text-stone-500 sm:flex"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Impatto ↑
        </span>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
          {quadrants.map((q) => (
            <div
              key={q.title}
              className={
                q.accent
                  ? "rounded-xl border-2 border-orange-500 bg-orange-50 p-4 shadow-sm sm:p-5"
                  : "rounded-xl border border-stone-200 bg-stone-50 p-4 sm:p-5"
              }
            >
              <p
                className={
                  q.accent
                    ? "text-[11px] font-semibold uppercase tracking-wide text-orange-700"
                    : "text-[11px] font-semibold uppercase tracking-wide text-stone-500"
                }
              >
                {q.eyebrow}
              </p>
              <h3
                className={
                  q.accent
                    ? "mt-1.5 font-serif text-base font-bold leading-snug text-stone-900 sm:text-lg"
                    : "mt-1.5 font-serif text-base font-bold leading-snug text-stone-800 sm:text-lg"
                }
              >
                {q.title}
              </h3>
              <p className="mt-1.5 text-sm leading-snug text-stone-600">{q.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <p
        aria-hidden="true"
        className="mt-2 hidden text-right text-xs font-medium uppercase tracking-widest text-stone-500 sm:block"
      >
        Prontezza →
      </p>

      <figcaption className="sr-only">
        Matrice di Kairós: quattro quadranti che incrociano impatto e prontezza
        organizzativa. In alto a sinistra, impatto alto e prontezza bassa: &quot;Prepara le
        condizioni&quot;. In alto a destra, impatto alto e prontezza alta: &quot;Kairós
        Autentico&quot;, il momento giusto per agire. In basso a sinistra, impatto basso
        e prontezza bassa: &quot;Non prioritario&quot;. In basso a destra, impatto basso
        e prontezza alta: &quot;Quick Win&quot;.
      </figcaption>
    </figure>
  );
}
