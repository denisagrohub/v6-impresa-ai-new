'use client';

// 05/10/2026 (C-playbook-3a/3b): modale "Invia playbook" per consulenti.
// Unifica export PDF + condivisione: scegli destinatari + oggetto +
// messaggio, allega il PDF, invia. Fallback "Scarica solo PDF".

import { useState } from 'react';
import { X, Loader2, AlertCircle, Mail, Download, CheckCircle2 } from 'lucide-react';

type Props = {
  projectId: number;
  projectName: string;
  onClose: () => void;
  onSent?: () => void;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function SendPlaybookModal({ projectId, projectName, onClose, onSent }: Props) {
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [subject, setSubject] = useState('Playbook ' + projectName + ' - V6 Impresa');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function parseRecipients(): string[] {
    return recipientsRaw
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSend() {
    const recipients = parseRecipients();
    if (recipients.length === 0) {
      setError('Inserisci almeno un destinatario.');
      return;
    }
    const invalid = recipients.filter((r) => !r.endsWith('@v6impresa.it'));
    if (invalid.length > 0) {
      setError(
        'Il playbook e riservato ai consulenti V6 (@v6impresa.it). ' +
        'Non validi: ' + invalid.join(', '),
      );
      return;
    }
    setSending(true); setError(null); setSuccess(null);
    try {
      const r = await fetch(
        '/api/consultant/partner-projects/' + projectId + '/playbook/send',
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients, subject, message }),
        },
      );
      const j = await r.json();
      const payload = j.data || j;
      if (!r.ok || payload.error) {
        throw new Error(payload.error || ('HTTP ' + r.status));
      }
      setSuccess(
        'Playbook inviato a ' + recipients.length + ' destinatario' +
        (recipients.length > 1 ? 'i' : ''),
      );
      if (onSent) onSent();
      setTimeout(() => { onClose(); }, 1500);
    } catch (e: any) {
      setError(e.message || 'Errore invio');
    } finally {
      setSending(false);
    }
  }

  async function handleDownload() {
    setDownloading(true); setError(null);
    try {
      const r = await fetch(
        '/api/consultant/partner-projects/' + projectId + '/playbook/pdf',
        { headers: authHeaders() },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: 'Errore download' }));
        throw new Error(j.error || ('HTTP ' + r.status));
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playbook_' + projectId + '.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Errore download PDF');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Invia playbook</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
            Il playbook e <strong>riservato ai consulenti V6</strong>.
            Il PDF viene allegato automaticamente.
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Destinatari (email @v6impresa.it, separati da virgola o spazio) *
            </label>
            <textarea
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              rows={2}
              placeholder="christian.girardi@v6impresa.it, denis.deste@v6impresa.it"
              className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1"
            />
            {recipientsRaw.trim() && (
              <p className="text-xs text-slate-500 mt-1">
                {parseRecipients().length} destinatario/i
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Oggetto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Messaggio (opzionale)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Testo che precede il PDF nel corpo email..."
              className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleDownload}
            disabled={downloading || sending}
            className="px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Download...' : 'Scarica solo PDF'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100"
            >
              Annulla
            </button>
            <button
              onClick={handleSend}
              disabled={sending || downloading || !recipientsRaw.trim()}
              className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {sending ? 'Invio...' : 'Invia email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
