"use client";
import { useEffect, useState } from "react";

// Contachilometri: cifre monospace con animazione counter.
export default function KpiOdometer({
  value, label, sublabel, color = "#0f172a",
}: {
  value: number; label?: string; sublabel?: string; color?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    const from = shown;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(from + (value - from) * easeOutCubic(p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className="flex items-end justify-center gap-2">
        <span
          className="font-mono tabular-nums text-5xl font-bold tracking-tight"
          style={{ color }}
        >
          {shown}
        </span>
      </div>
      {label && <div className="text-xs font-semibold text-gray-600 mt-2">{label}</div>}
      {sublabel && <div className="text-[10px] text-gray-400 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
