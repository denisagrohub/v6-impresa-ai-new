'use client';

// 03/10/2026 (C1b-agenda-COMPLETE-C): pagina di conferma RSVP.
// L'utente arriva qui dopo aver cliccato Accetta/Rifiuta nel link
// email. Query param: ?state=accepted|declined&event=<id>

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';

function RsvpDoneContent() {
  const params = useSearchParams();
  const state = params.get('state');
  const eventId = params.get('event');

  const accepted = state === 'accepted';
  const Icon = accepted ? CheckCircle2 : XCircle;
  const color = accepted ? 'text-emerald-600' : 'text-red-600';
  const bg = accepted ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200';
  const title = accepted ? 'Hai accettato' : 'Hai rifiutato';
  const subtitle = accepted
    ? 'Grazie per la conferma.'
    : 'Ci dispiace. Puoi comunque contattare l’organizzatore.';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className={`max-w-md w-full rounded-2xl border ${bg} p-8 text-center`}>
        <Icon size={48} className={`mx-auto ${color} mb-3`} />
        <h1 className={`text-2xl font-bold ${color} mb-2`}>{title}</h1>
        <p className="text-sm text-gray-600 mb-6">{subtitle}</p>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 rounded-lg bg-[#0F1E3C] text-white text-sm font-medium hover:bg-[#1a2f54]"
          >
            Torna alla dashboard
          </Link>
          {eventId && (
            <Link
              href={`/admin/appointments`}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50"
            >
              Vedi appuntamenti
            </Link>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-6">
          V6 Impresa — gestione appuntamenti
        </p>
      </div>
    </div>
  );
}

export default function RsvpDonePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Caricamento…</div>}>
      <RsvpDoneContent />
    </Suspense>
  );
}
