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
