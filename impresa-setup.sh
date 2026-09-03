#!/usr/bin/env bash
# setup: backup, branch, componenti condivisi. File senza caratteri dollaro (paste-safe).
set -e
cd /home/erpv6admin/erpv6-src


echo "VERIFICA REPO"
git fetch origin
git diff --quiet && git diff --cached --quiet || { echo "FERMO: working tree sporco, committa o stash"; exit 1; }
test -d apps/impresa/src/app || { echo "FERMO: struttura inaspettata"; exit 1; }
test -f apps/impresa/src/components/interview/InterviewTreeFlow.tsx || { echo "FERMO: InterviewTreeFlow mancante"; exit 1; }
git branch --show-current

echo "BACKUP"
tar -czf /home/erpv6admin/backup_impresa_src.tar.gz apps/impresa/src
echo "Backup: /home/erpv6admin/backup_impresa_src.tar.gz"

echo "BRANCH"
git checkout -b feature/impresa-redesign-v3 2>/dev/null && echo "Branch creato" || { echo "FERMO: branch esiste gia"; exit 1; }

echo "TOKENS"
cat > apps/impresa/tokens-impresa.md <<'EOF'
# Design tokens v6impresa - FONTE DI VERITA
navy:#0F1E3C crema:#F7F3ED terracotta:#D4703A critico:#C4453A
attenzione:#D9A441 positivo:#4E8B5C ink-crema:#1C2128 ink-navy:#F8F6F2
REGOLE: (1) terracotta SOLO CTA / linea-metodo / numeri animati.
(2) I 3 colori di stato MAI per CTA, MAI nella stessa sezione del terracotta.
(3) Alternare sezioni navy/crema.
(4) Tailwind 3.4.4: rounded-sm, shadow-sm, backdrop-blur-sm (NON varianti v4).
EOF

mkdir -p apps/impresa/src/components/shared

cat > apps/impresa/src/components/shared/MetodoLine.tsx <<'EOF'
"use client";
// Linea del metodo - terracotta su navy. Riuso: home, attesa, chi-siamo.
// variant="scroll": disegnata allo scroll. variant="loop": ciclo 2.5s (attesa).
// NOTA per Code: posizioni nodi approssimate, rifinire con path.getPointAtLength().
import { useEffect, useRef, useState } from "react";

const PATH = "M 20 160 C 120 60, 240 220, 360 120 S 600 40, 720 140";
const DASH = 1200;
const NODES = [
  { x: 20, y: 160, n: "01" },
  { x: 250, y: 175, n: "02" },
  { x: 470, y: 90, n: "03" },
  { x: 720, y: 140, n: "04" },
];

export default function MetodoLine(props: {
  variant?: "scroll" | "loop";
  className?: string;
}) {
  const variant = props.variant ?? "scroll";
  const progressState = useState(variant === "loop" ? 1 : 0);
  const progress = progressState[0];
  const setProgress = progressState[1];
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (variant !== "scroll" || !ref.current) return;
    const onScroll = () => {
      const r = ref.current!.getBoundingClientRect();
      const p = Math.min(1, Math.max(0,
        (window.innerHeight - r.top) / (window.innerHeight + r.height * 0.5)));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant, setProgress]);

  return (
    <svg ref={ref} viewBox="0 0 740 220" fill="none" className={props.className} aria-hidden="true">
      <path
        d={PATH} stroke="#D4703A" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={DASH}
        strokeDashoffset={variant === "loop" ? undefined : DASH * (1 - progress)}
        className={variant === "loop" ? "metodo-loop-anim" : undefined}
      />
      {NODES.map((p) => (
        <g key={p.n}>
          <circle cx={p.x} cy={p.y} r="14" fill="#0F1E3C" stroke="#D4703A" strokeWidth="2" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="#D4703A" fontWeight="600">
            {p.n}
          </text>
        </g>
      ))}
    </svg>
  );
}
EOF

if ! grep -q "metodo-loop-anim" apps/impresa/src/app/globals.css 2>/dev/null; then
cat >> apps/impresa/src/app/globals.css <<'EOF'

/* Linea del metodo - variante loop (schermata attesa report) */
@keyframes metodo-loop { 0% { stroke-dashoffset: 1200; } 100% { stroke-dashoffset: 0; } }
.metodo-loop-anim { animation: metodo-loop 2.5s linear infinite; }
EOF
fi

cat > apps/impresa/src/components/shared/StateBadge.tsx <<'EOF'
// Badge di stato qualitativo - SOLO i tre colori di stato, MAI terracotta.
import type { ReactNode } from "react";

type Stato = "positivo" | "attenzione" | "critico";

const CLS: Record<Stato, string> = {
  positivo: "border-[#4E8B5C] bg-[#4E8B5C]/10 text-[#4E8B5C]",
  attenzione: "border-[#D9A441] bg-[#D9A441]/10 text-[#D9A441]",
  critico: "border-[#C4453A] bg-[#C4453A]/10 text-[#C4453A]",
};

export default function StateBadge(props: { stato: Stato; children: ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded-sm border px-3 py-1 text-sm font-semibold " + CLS[props.stato]}>
      {props.children}
    </span>
  );
}
EOF

cat > apps/impresa/src/components/shared/BlurLock.tsx <<'EOF'
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
EOF

echo "SETUP COMPLETO. Prossimo passo: genera ed esegui i file di task per Claude Code."