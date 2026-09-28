'use client';

import { FileSignature, ExternalLink, CheckCircle2, Clock, XCircle, Eye } from 'lucide-react';

export type SignRequest = {
  id: number;
  name: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'declined' | 'cancelled';
  partnerId: number;
  partnerName: string;
  partnerEmail: string;
  requestUrl: string;
  externalId: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  contractDraftId: number | null;
};

const STATUS_STYLE: Record<SignRequest['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  draft:     { label: 'Bozza',        cls: 'bg-gray-50 text-gray-600 border-gray-300',     Icon: Clock },
  sent:      { label: 'Inviata',      cls: 'bg-blue-50 text-blue-700 border-blue-300',     Icon: Clock },
  viewed:    { label: 'Visualizzata', cls: 'bg-amber-50 text-amber-800 border-amber-300',  Icon: Eye },
  signed:    { label: 'Firmata',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: CheckCircle2 },
  expired:   { label: 'Scaduta',      cls: 'bg-slate-100 text-slate-600 border-slate-300', Icon: XCircle },
  declined:  { label: 'Rifiutata',    cls: 'bg-red-50 text-red-700 border-red-300',        Icon: XCircle },
  cancelled: { label: 'Annullata',    cls: 'bg-slate-100 text-slate-600 border-slate-300', Icon: XCircle },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export function SignRequestsPanel({ requests }: { requests: SignRequest[] }) {
  if (!requests || requests.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-3">
        Nessuna richiesta di firma. Congela il deal e clicca &quot;Invia in firma&quot;.
      </p>
    );
  }

  const signedCount = requests.filter(r => r.status === 'signed').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>{signedCount} firmate su {requests.length}</span>
      </div>

      {requests.map(r => {
        const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft;
        const Icon = s.Icon;
        return (
          <div
            key={r.id}
            className={`rounded-lg border p-3 ${s.cls}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{r.partnerName}</span>
                  <span className="text-xs opacity-70 truncate">{r.partnerEmail}</span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] opacity-80">
                  {r.sentAt && <span>Inviata: {fmtDate(r.sentAt)}</span>}
                  {r.viewedAt && <span>Vista: {fmtDate(r.viewedAt)}</span>}
                  {r.signedAt && <span>Firmata: {fmtDate(r.signedAt)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {r.requestUrl && r.status !== 'signed' && (
                  <a
                    href={r.requestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded border border-current text-[11px] font-semibold hover:bg-white/50"
                    title="Apri la pagina di firma su Documenso"
                  >
                    <FileSignature size={11} />
                    Apri
                    <ExternalLink size={10} />
                  </a>
                )}
                <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold">
                  {s.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
