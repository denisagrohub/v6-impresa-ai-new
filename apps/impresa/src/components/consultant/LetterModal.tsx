'use client';

// 05/10/2026 (C-playbook-3d): modale "Genera lettera" per consulenti.
// 4 varianti (facilitator/buyer/seller/studio), preview live, PDF, copia.
// Template puro backend, zero AI.

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Download, Copy, CheckCircle2, FileText } from 'lucide-react';

type Variant = 'facilitator' | 'buyer' | 'seller' | 'studio';

const VARIANTS: Array<{ code: Variant; label: string; descr: string }> = [
  { code: 'facilitator', label: 'Facilitatore', descr: 'Per chi porta controparti' },
  { code: 'buyer', label: 'Compratore', descr: 'Per chi compra crediti' },
  { code: 'seller', label: 'Cedente', descr: 'Per aziende con crediti da cedere' },
  { code: 'studio', label: 'Studio / commercialista', descr: 'Per commercialisti/consulenti' },
];

type Props = {
  projectId: number;
  projectName: string;
  onClose: () => void;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function LetterModal({ projectId, projectName, onClose }: Props) {
  const [variant, setVariant] = useState<Variant>('facilitator');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalization, setPersonalization] = useState('');
  const [preview, setPreview] = useState<{ subject: string; body_html: string; body_text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview: fetch su cambio (debounce 500ms)
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(
          `/api/consultant/partner-projects/${projectId}/playbook/letter`,
          {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variant,
              recipient_name: recipientName,
              recipient_email: recipientEmail,
              personalization,
            }),
          },
        );
        const j = await r.json();
        const payload = j.data || j;
        if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
        setPreview({
          subject: payload.subject || '',
          body_html: payload.body_html || '',
          body_text: payload.body_text || '',
        });
      } catch (e: any) {
        setError(e.message || 'Errore generazione');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [variant, recipientName, recipientEmail, personalization, projectId]);

  async function handleDownloadPdf() {
    setDownloading(true); setError(null);
    try {
      const r = await fetch(
        `/api/consultant/partner-projects/${projectId}/playbook/letter/pdf`,
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant,
            recipient_name: recipientName,
            recipient_email: recipientEmail,
            personalization,
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: 'Errore PDF' }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lettera_${variant}_${projectId}.pdf`;
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

  async function handleCopyText() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.body_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      setError('Impossibile copiare: ' + (e.message || ''));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Genera lettera</h2>
              <p className="text-xs text-slate-500 mt-0.5">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body: due colonne su schermi larghi */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* Colonna sinistra: input */}
            <div className="p-6 space-y-5 lg:border-r lg:border-slate-200">

              {/* Variante */}
              <section>
                <label className="text-xs font-medium text-slate-600 block mb-2">Tipo destinatario</label>
                <div className="space-y-1.5">
                  {VARIANTS.map((v) => (
                    <label
                      key={v.code}
                      className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm ${
                        variant === v.code
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="variant"
                        value={v.code}
                        checked={variant === v.code}
                        onChange={() => setVariant(v.code)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{v.label}</div>
                        <div className="text-xs text-slate-500">{v.descr}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Destinatario */}
              <section className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Nome destinatario {variant === 'seller' || variant === 'studio' ? '(es. "Dott. Rossi")' : '(es. "Marco")'}
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={variant === 'seller' || variant === 'studio' ? 'Dott. Mario Rossi' : 'Marco'}
                    className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Email destinatario (opzionale)</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="mario.rossi@azienda.it"
                    className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                  />
                </div>
              </section>

              {/* Personalizzazione */}
              <section>
                <label className="text-xs font-medium text-slate-600">
                  Personalizzazione (opzionale)
                </label>
                <textarea
                  value={personalization}
                  onChange={(e) => setPersonalization(e.target.value)}
                  rows={3}
                  placeholder="Testo che verra' inserito prima della firma (es. 'Ci siamo conosciuti al convegno di Bologna')"
                  className="mt-1 w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                />
              </section>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}
            </div>

            {/* Colonna destra: preview */}
            <div className="p-6 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-slate-600">Anteprima lettera</label>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>

              {preview ? (
                <div className="bg-white border border-slate-200 rounded p-4 text-sm">
                  <div className="border-b border-slate-100 pb-3 mb-3">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Oggetto</div>
                    <div className="font-semibold text-slate-900 mt-1">{preview.subject}</div>
                  </div>
                  <div
                    className="text-sm text-slate-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: preview.body_html }}
                  />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded p-6 text-center text-slate-400 text-sm">
                  {loading ? 'Generazione…' : 'Seleziona una variante per vedere l\'anteprima'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleCopyText}
            disabled={!preview || loading}
            className="px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiato' : 'Copia testo'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100"
            >
              Chiudi
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={!preview || downloading || loading}
              className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generazione…' : 'Scarica PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
