'use client';
import { useEffect, useState } from 'react';
import { Loader2, Reply, Send, Paperclip, Download, X, Link2, AlertCircle, Pencil } from 'lucide-react';
import { projectColor } from '@/lib/email-hub/colors';
import { formatDateFull, extractEmail, extractName, formatSize } from '@/lib/email-hub/format';
import EmailHubBadge from './EmailHubBadge';
import IntelligencePanel from './IntelligencePanel';
import EmailHubLinkProjectModal from './EmailHubLinkProjectModal';
import { Message } from './EmailHubListItem';

type Attachment = { id: number; name: string; size: number; mimetype: string };
type Detail = {
  message: Message;
  thread: Message[];
  attachments: Attachment[];
};

type Props = {
  messageId: number | null;
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onReplied?: () => void;
};

export default function EmailHubDetail({ messageId, authHeaders, onClose, onReplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  // 13/10/2026 (STEP C): link project modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const unlinkProject = async () => {
    if (!messageId) return;
    try {
      await fetch(`/api/admin/emails/${messageId}/link-project`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setReloadKey((k) => k + 1);
    } catch { /* ignore */ }
  };

  const onLinkSaved = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!messageId) { setDetail(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/admin/email-hub/messages/${messageId}`, { headers: authHeaders() });
        const d = await r.json();
        if (cancelled) return;
        if (!d.success) { setError(d.error || 'Errore'); return; }
        setDetail(d.data || d);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [messageId, reloadKey]);

  // Mark-read automatico alla apertura
  useEffect(() => {
    if (!messageId) return;
    fetch(`/api/admin/email-hub/messages/${messageId}/mark-read`, {
      method: 'POST', headers: authHeaders(),
    }).catch(() => {});
  }, [messageId]);

  if (!messageId) {
    return (
      <aside className="w-[640px] shrink-0 border-l border-brand-border bg-brand-card">
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-brand-sand mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">✉️</span>
            </div>
            <p className="text-sm text-brand-muted">Seleziona un&apos;email dalla lista per vederla qui.</p>
          </div>
        </div>
      </aside>
    );
  }

  const sendReply = async () => {
    if (!replyBody.trim() || sending) return;
    setSending(true); setSentOk(false); setError(null);
    try {
      const r = await fetch(`/api/admin/email-hub/messages/${messageId}/reply`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body_html: `<p>${replyBody.replace(/\n/g, '<br/>')}</p>` }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Errore invio'); return; }
      setSentOk(true);
      setReplyBody('');
      setReplyOpen(false);
      onReplied?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const m = detail?.message;
  const pc = m?.project ? projectColor(m.project.id) : null;

  return (
    <aside className="w-[640px] shrink-0 border-l border-brand-border bg-brand-card shadow-hub-panel">
      {loading && (
        <div className="h-full flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-brand-muted" />
        </div>
      )}

      {!loading && error && (
        <div className="p-6">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && m && (
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="p-5 border-b border-brand-border shrink-0">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-brand-navy leading-snug">
                  {m.subject || '(nessun oggetto)'}
                </h2>
                <div className="text-xs text-brand-muted mt-1">
                  {formatDateFull(m.date)}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-brand-sand transition-colors shrink-0"
                title="Chiudi"
              >
                <X size={16} className="text-brand-muted" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              {m.project && pc && (
                <EmailHubBadge
                  label={pc.name || m.project.name}
                  color={pc.color} bg={pc.bg} border={pc.border}
                />
              )}
              {!m.project && (
                <EmailHubBadge label="senza progetto" />
              )}
              <EmailHubBadge
                label={m.direction === 'out' ? 'Inviata' : 'Ricevuta'}
                color={m.direction === 'out' ? '#10b981' : '#3b82f6'}
                bg={m.direction === 'out' ? '#ecfdf5' : '#eff6ff'}
                border={m.direction === 'out' ? '#a7f3d0' : '#bfdbfe'}
              />
            </div>

            <div className="text-xs text-brand-muted space-y-0.5">
              <div>
                <span className="font-semibold text-brand-text">Da:</span>{' '}
                {extractName(m.email_from) || m.email_from || '—'}
                <span className="opacity-60"> &lt;{extractEmail(m.email_from)}&gt;</span>
              </div>
              {m.email_to && (
                <div>
                  <span className="font-semibold text-brand-text">A:</span>{' '}
                  <span className="opacity-80">{m.email_to}</span>
                </div>
              )}
            </div>

            {/* 13/10/2026 (STEP C): 3 stati link progetto */}
            <div className="mt-3">
              {!m.x_v6_project_id && (
                <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span className="text-amber-800 flex-1">Non collegata a un progetto</span>
                  <button
                    onClick={() => setLinkModalOpen(true)}
                    className="text-xs font-medium text-brand-navy hover:underline whitespace-nowrap"
                  >
                    🔗 Collega
                  </button>
                </div>
              )}

              {m.x_v6_project_id && !m.x_v6_parte_id && (
                <div className="flex items-center gap-2 text-xs bg-brand-sand border border-brand-border rounded-lg px-3 py-2">
                  <Link2 size={14} className="text-brand-navy shrink-0" />
                  <span className="text-brand-text flex-1 truncate">
                    <b>{m.x_v6_project?.name || `Progetto #${m.x_v6_project_id}`}</b>
                  </span>
                  <button
                    onClick={() => setLinkModalOpen(true)}
                    className="text-[11px] font-medium text-brand-navy hover:underline whitespace-nowrap inline-flex items-center gap-1"
                  >
                    <Pencil size={11} /> Assegna a parte
                  </button>
                  <button
                    onClick={unlinkProject}
                    className="text-brand-muted hover:text-red-600"
                    title="Rimuovi link"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {m.x_v6_project_id && m.x_v6_parte_id && (
                <div className="flex items-center gap-2 text-xs bg-brand-sand border border-brand-border rounded-lg px-3 py-2">
                  <Link2 size={14} className="text-brand-navy shrink-0" />
                  <span className="text-brand-text flex-1 truncate">
                    <b>{m.x_v6_project?.name || `Progetto #${m.x_v6_project_id}`}</b>
                    {m.x_v6_parte?.name && (
                      <> · Parte: <b>{m.x_v6_parte.name}</b></>
                    )}
                  </span>
                  <button
                    onClick={() => setLinkModalOpen(true)}
                    className="text-[11px] font-medium text-brand-navy hover:underline whitespace-nowrap inline-flex items-center gap-1"
                  >
                    <Pencil size={11} /> Cambia parte
                  </button>
                  <button
                    onClick={unlinkProject}
                    className="text-brand-muted hover:text-red-600"
                    title="Rimuovi link"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto email-hub-scroll p-5 min-h-0">
            <div
              className="prose prose-sm max-w-none text-brand-text"
              dangerouslySetInnerHTML={{ __html: (detail as any)?.body || '' }}
            />

            {detail?.attachments && detail.attachments.length > 0 && (
              <div className="mt-5 pt-4 border-t border-brand-border">
                <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">
                  Allegati ({detail.attachments.length})
                </div>
                <div className="space-y-1.5">
                  {detail.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/admin/attachments/${a.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg border border-brand-border hover:bg-brand-sand transition-colors"
                    >
                      <Paperclip size={14} className="text-brand-muted" />
                      <span className="flex-1 text-xs truncate">{a.name}</span>
                      <span className="text-[10px] text-brand-muted">{formatSize(a.size)}</span>
                      <Download size={12} className="text-brand-muted" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Intelligence panel Susanna (mock v1) */}
          <div className="border-t border-brand-border bg-brand-sand/50 shrink-0">
            <IntelligencePanel
              project={m.project}
              authorName={extractName(m.email_from) || extractEmail(m.email_from)}
              subject={m.subject}
            />
          </div>

          {/* Reply footer */}
          <div className="border-t border-brand-border p-4 bg-brand-sand shrink-0">
            {!replyOpen ? (
              <button
                onClick={() => setReplyOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-navy text-white text-sm font-semibold hover:bg-brand-navy/90 transition-colors"
              >
                <Reply size={15} /> Rispondi
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Scrivi la tua risposta…"
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta transition-colors resize-none"
                  disabled={sending}
                />
                {sentOk && (
                  <div className="text-xs text-emerald-600">Risposta inviata ✓</div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setReplyOpen(false); setReplyBody(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg hover:bg-brand-card transition-colors text-brand-muted"
                    disabled={sending}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyBody.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-terracotta text-white text-xs font-semibold hover:bg-brand-terracotta/90 transition-colors disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Invia
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <EmailHubLinkProjectModal
        open={linkModalOpen}
        messageId={messageId}
        currentProjectId={detail?.message?.x_v6_project_id ?? null}
        currentParteId={detail?.message?.x_v6_parte_id ?? null}
        authHeaders={authHeaders}
        onClose={() => setLinkModalOpen(false)}
        onSaved={onLinkSaved}
      />
    </aside>
  );
}
