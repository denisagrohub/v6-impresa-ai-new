'use client';

const STYLES: Record<string, { label: string; cls: string }> = {
  scouting: { label: 'Scouting', cls: 'bg-gray-50 text-gray-600 border-gray-300' },
  partner:  { label: 'Partner',  cls: 'bg-blue-50 text-blue-700 border-blue-300' },
  attivo:   { label: 'Attivo',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  degradato:{ label: 'Degradato',cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  chiuso:   { label: 'Chiuso',   cls: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export function LifecycleBadge({
  stage,
  className = '',
}: {
  stage?: string | null;
  className?: string;
}) {
  const s = STYLES[stage ?? 'partner'] ?? STYLES.partner;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${s.cls} ${className}`}
    >
      {s.label}
    </span>
  );
}
