"use client";
import { useEffect, useState } from "react";

// Tachigrafo: arco 180° con ago che punta al valore corrente.
export default function KpiGauge({
  value, max, label, sublabel, color = "#1a7fa8",
}: {
  value: number; max: number; label?: string; sublabel?: string; color?: string;
}) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 50);
    return () => clearTimeout(t);
  }, [value]);

  const pct = max > 0 ? Math.min(1, animated / max) : 0;
  const angle = -90 + pct * 180; // da -90° a +90° sull'arco superiore

  // Arco semicircolare: centro (100,100), raggio 70
  const cx = 100, cy = 100, r = 70;
  const startAngle = 180, endAngle = 0;
  const arcPath = describeArc(cx, cy, r, startAngle, endAngle);

  // Ago (linea dal centro)
  const rad = (angle * Math.PI) / 180;
  const needleX = cx + r * 0.85 * Math.sin(rad);
  const needleY = cy - r * 0.85 * Math.cos(rad);

  return (
    <svg viewBox="0 0 200 130" className="w-full h-auto">
      {/* Arco sfondo */}
      <path d={arcPath} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
      {/* Arco valore */}
      <path
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${pct * 220} 999`}
        style={{ transition: "stroke-dasharray 800ms ease-out" }}
      />
      {/* Tacca centro */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY}
        stroke={color} strokeWidth="3" strokeLinecap="round"
        style={{ transition: "all 800ms ease-out" }} />
      <circle cx={cx} cy={cy} r="6" fill="#0f172a" />
      <circle cx={cx} cy={cy} r="3" fill="white" />
      {/* Valori */}
      <text x={cx} y={cy - 15} textAnchor="middle" className="fill-[#0f172a] font-bold" style={{ fontSize: "22px" }}>
        {value}
      </text>
      <text x={cx} y={cy + 25} textAnchor="middle" className="fill-gray-400" style={{ fontSize: "11px" }}>
        / {max}
      </text>
      {label && <text x={cx} y={cy + 42} textAnchor="middle" className="fill-gray-500 font-medium" style={{ fontSize: "10px" }}>{label}</text>}
      {sublabel && <text x={cx} y={cy + 56} textAnchor="middle" className="fill-gray-400" style={{ fontSize: "9px" }}>{sublabel}</text>}
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
