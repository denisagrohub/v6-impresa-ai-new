'use client';

// 09/10/2026 (C-email-project-1): modale inline per dettaglio email dalla
// timeline. Chiama GET /api/admin/emails/<id>?kind=<source>.

import { useEffect, useState } from 'react';
import { X, Loader2, Mail, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';

type Props = {
  emailLogId: number;
  source: 'winwin' | 'project';
  authToken: string;
  onClose: () => void;
};

type EmailDetail = {
  name?: string;
  sender_email?: string;
  recipient_emails?: string;
  cc_emails?: string;
  direction?: string;
  body_html?: string;
  create_date?: string;
};

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function EmailPreviewModal({ emailLogId, source, authToken, onClose }: Props) {
  const [data, setData] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `/api/admin/emails/${emailLogId}?kind=${source}`,
          { headers: { Authorization: `JWT ${authToken}` } },
        );
        const j = await r.json();
        const payload = j.data || j;
        if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
        setData(payload);
      } catch (e: any) {
        setError(e.message || 'Errore caricamento email');
      } finally {
        setLoading(false);
      }
    })();
  }, [emailLogId, source, authToken]);

  const isInviata = (data?.direction || '') === 'inviata';
  const Icon = isInviata ? ArrowUpRight : ArrowDownLeft;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-[#1a2744]">Dettaglio email</h2>
            {data?.direction && (
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                isInviata ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                <Icon size={10} />
                {isInviata ? 'Inviata' : 'Ricevuta'}
              </span>
            )}
            <span className="text-[10px] text-gray-400 uppercase">
              {source === 'winwin' ? 'Casella' : 'Progetto'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              Carico email…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Oggetto</div>
                <div className="text-sm font-semibold text-[#1a2744]">
                  {data.name || '(nessun oggetto)'}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-400">Da:</span>{' '}
                  <span className="text-gray-700 break-all">{data.sender_email || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400">A:</span>{' '}
                  <span className="text-gray-700 break-all">{data.recipient_emails || '—'}</span>
                </div>
                {data.cc_emails && (
                  <div>
                    <span className="text-xs text-gray-400">Cc:</span>{' '}
                    <span className="text-gray-700 break-all">{data.cc_emails}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-400">Data:</span>{' '}
                  <span className="text-gray-700">{fmtDate(data.create_date)}</span>
                </div>
              </div>
              {data.body_html && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Contenuto</div>
                  <div
                    className="prose prose-sm max-w-none text-gray-700 text-sm"
                    dangerouslySetInnerHTML={{ __html: data.body_html }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
