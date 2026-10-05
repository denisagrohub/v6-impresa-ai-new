'use client';

// 05/10/2026 (C-attribution-1f): typeahead partner per la modale
// attribuzione. Sostituisce il prompt() con ID numerico.

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export type PartnerValue = { id: number; name: string } | null;

type Partner = {
  id: number;
  name: string;
  email: string;
  vat: string;
};

type Props = {
  value: PartnerValue;
  onChange: (p: PartnerValue) => void;
  placeholder?: string;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function PartnerAutocomplete({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce 300ms
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/admin/partners/search?q=${encodeURIComponent(query)}&limit=15`,
          { headers: authHeaders() },
        );
        const j = await r.json();
        const payload = j.data || j;
        setResults(payload.partners || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open]);

  // Click fuori → chiudi
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function pick(p: Partner) {
    onChange({ id: p.id, name: p.name });
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setResults([]);
  }

  // Se value è presente → mostra nome + X (non input)
  if (value && !open) {
    return (
      <div className="flex items-center gap-2 text-sm border border-slate-200 rounded px-2 py-1 bg-white">
        <span className="flex-1 truncate">{value.name}</span>
        <button
          type="button"
          onClick={clear}
          className="p-0.5 text-slate-400 hover:text-red-500"
          aria-label="Rimuovi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Cambia
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 text-sm border border-slate-200 rounded px-2 py-1 bg-white focus-within:border-blue-400">
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Cerca per nome, email o P.IVA…'}
          className="flex-1 outline-none bg-transparent"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        {(query || value) && (
          <button type="button" onClick={clear} className="p-0.5 text-slate-400 hover:text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-64 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">Ricerca…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 italic">Nessun risultato</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              <div className="font-medium text-slate-900 truncate">{p.name}</div>
              {(p.email || p.vat) && (
                <div className="text-xs text-slate-500 truncate">
                  {p.email}{p.email && p.vat ? ' · ' : ''}{p.vat}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
