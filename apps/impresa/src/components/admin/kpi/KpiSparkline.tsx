"use client";

// Sparkline minimalista: linea + area sfumata.
export default function KpiSparkline({
  values, color = "#1a7fa8", height = 50,
}: {
  values: number[]; color?: string; height?: number;
}) {
  if (!values || values.length === 0) {
    return <div className="flex items-center justify-center text-gray-300 text-xs italic py-4">nessun dato</div>;
  }
  const w = 200;
  const h = height;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${h} L ${points[0][0]} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
