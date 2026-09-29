// ═══════════════════════════════════════════════════════════════════
// DealHeaderActions — header azioni del deal: torna, rigenera, congela,
// invia in firma. Estratto il 29/09/2026 (Refactor C, step C1.a) da:
//   app/admin/deals/[id]/page.tsx  (blocco header azioni)
// Motivo: spezzare monolite page.tsx (578 righe) in componenti tipati.
// Zero cambio di comportamento: stesse classi, stesso ordine, stesse
// condizioni disabled. Props tipizzate, callback esterna onAction.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { ArrowLeft, Snowflake, FileSignature, RefreshCw } from 'lucide-react';

export type DealAction = 'freeze' | 'send-to-sign' | 'recompute';

type Props = {
  canFreeze: boolean;
  canSign: boolean;
  actionLoading: string | null;
  onAction: (action: DealAction) => void;
};

export function DealHeaderActions({ canFreeze, canSign, actionLoading, onAction }: Props) {
  const busy = actionLoading !== null;

  return (
    <div className="mb-4 flex items-center justify-between">
      <a
        href="/admin/deals"
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Torna alla lista
      </a>

      <div className="flex gap-2 items-center">
        {/* Rigenera = ri-esegue il calcolo (refreeze per ora) */}
        <button
          onClick={() => onAction('recompute')}
          disabled={busy}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'recompute' ? 'animate-spin' : ''}`} />
          {actionLoading === 'recompute' ? 'Rigenero…' : 'Rigenera'}
        </button>

        {/* Congela = passa a frozen, abilita invio in firma */}
        <button
          onClick={() => onAction('freeze')}
          disabled={!canFreeze || busy}
          className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
            canFreeze && !busy
              ? 'bg-cyan-600 text-white hover:bg-cyan-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Snowflake className="w-3.5 h-3.5" />
          {actionLoading === 'freeze' ? 'Congelo…' : 'Congela'}
        </button>

        {/* Invia in firma = richiede deal congelato */}
        <button
          onClick={() => onAction('send-to-sign')}
          disabled={!canSign || busy}
          className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
            canSign && !busy
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <FileSignature className="w-3.5 h-3.5" />
          {actionLoading === 'send-to-sign' ? 'Invio…' : 'Invia in firma'}
        </button>
      </div>
    </div>
  );
}
