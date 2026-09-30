// ═══════════════════════════════════════════════════════════════════
// /consultant/mia-email — layout 3 colonne Gmail-style per consultant.
//
// Blocco 4b (30/09/2026): grafica identica a /admin/mia-email, ma con
// le API consultant (/api/consultant/emails/*). Le caselle sono derivate
// client-side raggruppando per matched_alias (l'API consultant non ha
// un endpoint /mailboxes separato).
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, RefreshCw, Inbox, Send, Archive, Mail, ChevronLeft, Circle,
  Paperclip, Reply, ReplyAll, Forward, Loader2, PenTool, ArrowLeft,
} from 'lucide-react';

type Email = {
  id: number;
  kind: 'winwin' | 'project';
  subject: string;
  sender_email: string;
  recipient_emails: string;
  cc_emails: string;
  matched_alias: string;
  direction: 'ricevuta' | 'inviata';
  relation_id: number | null;
  relation_name: string | null;
  create_date: string | null;
  is_read?: boolean;
  is_archived?: boolean;
};

type Mailbox = { alias: string; label: string; total: number; unread: number; lastDate: string | null };
type Detail = {
  id: number;
  subject: string;
  sender_email: string;
  recipient_emails: string;
  cc_emails: string;
  relation_id: number | null;
  relation_name: string | null;
  create_date: string | null;
  body: string;
};
type Attachment = { id: number; name: string; size: number };

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function extractEmail(s: string): string {
  if (!s) return '';
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : s.trim();
}

export default function ConsultantMiaEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>('__all__');
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'in' | 'out'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [selected, setSelected] = useState<Email | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Auth headers
  const authHeaders = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem('pi_session');
      const s = raw ? JSON.parse(raw) : null;
      return s?.token ? { Authorization: `JWT ${s.token}` } : {};
    } catch { return {}; }
  };

  useEffect(() => {
    const raw = localStorage.getItem('pi_session');
    if (!raw) { router.push('/login'); return; }
    setUser(JSON.parse(raw));
  }, [router]);

  const loadEmails = async () => {
    setEmailsLoading(true);
    try {
      const qs = showArchived ? '?archived=1' : '';
      const r = await fetch(`/api/consultant/emails${qs}`, { headers: authHeaders() });
      const d = await r.json();
      const list: Email[] = d.emails || d.data?.emails || [];
      setAllEmails(list);
    } catch (e) {
      console.error(e);
    } finally {
      setEmailsLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    loadEmails();
  }, [user, showArchived]);

  // Derivo caselle client-side
  useEffect(() => {
    const map: Record<string, Mailbox> = {};
    // Casella personale sempre presente
    const slug = user?.emailSlug;
    if (slug) {
      map[slug] = { alias: slug, label: slug, total: 0, unread: 0, lastDate: null };
    }
    for (const e of allEmails) {
      const a = e.matched_alias || '(senza casella)';
      if (!map[a]) map[a] = { alias: a, label: a, total: 0, unread: 0, lastDate: null };
      map[a].total += 1;
      if (e.direction === 'ricevuta' && !e.is_read) map[a].unread += 1;
      if (!map[a].lastDate || (e.create_date && e.create_date > (map[a].lastDate || ''))) {
        map[a].lastDate = e.create_date;
      }
    }
    const sorted = Object.values(map).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
    setMailboxes(sorted);
  }, [allEmails, user]);

  // Filtro lista visibile
  const visibleEmails = allEmails.filter(e => {
    if (activeMailbox !== '__all__' && activeMailbox !== '__sent__') {
      if (e.matched_alias !== activeMailbox) return false;
    }
    if (activeMailbox === '__sent__' && e.direction !== 'inviata') return false;
    if (filterDirection === 'in' && e.direction !== 'ricevuta') return false;
    if (filterDirection === 'out' && e.direction !== 'inviata') return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = (e.subject + ' ' + e.sender_email + ' ' + e.recipient_emails).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const openEmail = async (e: Email) => {
    setSelected(e);
    setDetail(null);
    setAttachments([]);
    setDetailLoading(true);
    try {
      const qs = `?kind=${e.kind}`;
      const [dRes, aRes] = await Promise.all([
        fetch(`/api/consultant/emails/${e.id}${qs}`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`/api/consultant/emails/${e.id}/attachments${qs}`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
      ]);
      const dd = dRes.data || dRes;
      if (dd && dd.id) setDetail(dd);
      const aa = aRes.data || aRes;
      setAttachments(aa?.attachments || []);
      // mark-read (best-effort)
      fetch(`/api/consultant/emails/${e.id}/mark-read${qs}`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const doAction = async (e: Email, action: 'archive' | 'unarchive') => {
    try {
      await fetch(`/api/consultant/emails/${e.id}/${action}?kind=${e.kind}`, {
        method: 'POST', headers: authHeaders(),
      });
      setSelected(null);
      setDetail(null);
      loadEmails();
    } catch (err) { console.error(err); }
  };

  const openReply = (e: Email) => {
    // Semplice: apre composer con link — per ora usa il composer dashboard
    router.push(`/consultant/dashboard?tab=email&reply=${e.id}&kind=${e.kind}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const unreadTotal = allEmails.filter(e => e.direction === 'ricevuta' && !e.is_read).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* SIDEBAR sinistra: caselle (stile Gmail) */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <Link href="/consultant/dashboard" className="p-1 rounded hover:bg-gray-100" title="Torna alla dashboard">
            <ArrowLeft size={14} className="text-gray-600" />
          </Link>
          <h2 className="text-xs font-bold text-[#1a2744] uppercase tracking-wider flex-1">Caselle</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Tutte */}
          <button
            onClick={() => { setActiveMailbox('__all__'); setSelected(null); setDetail(null); }}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-left mb-0.5 ${
              activeMailbox === '__all__' ? 'bg-[#1a2744] text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}>
            <Inbox size={14} />
            <span className="flex-1 truncate">Tutte le email</span>
            {unreadTotal > 0 && (
              <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                activeMailbox === '__all__' ? 'bg-white text-[#1a2744]' : 'bg-amber-500 text-white'
              }`}>{unreadTotal}</span>
            )}
          </button>

          {mailboxes.map(mb => (
            <button
              key={mb.alias}
              onClick={() => { setActiveMailbox(mb.alias); setSelected(null); setDetail(null); }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-left mb-0.5 ${
                activeMailbox === mb.alias ? 'bg-[#1a2744] text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}>
              <Mail size={14} />
              <span className="flex-1 truncate" title={mb.label}>{mb.label}</span>
              {mb.unread > 0 && (
                <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeMailbox === mb.alias ? 'bg-white text-[#1a2744]' : 'bg-amber-500 text-white'
                }`}>{mb.unread}</span>
              )}
            </button>
          ))}

          {/* Inviate */}
          <button
            onClick={() => { setActiveMailbox('__sent__'); setSelected(null); setDetail(null); }}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-left mb-0.5 ${
              activeMailbox === '__sent__' ? 'bg-[#1a2744] text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}>
            <Send size={14} />
            <span className="flex-1 truncate">Inviate</span>
          </button>
        </div>
      </aside>

      {/* LISTA email */}
      <div className={`${selected ? 'w-80' : 'flex-1'} bg-white border-r border-gray-200 flex flex-col flex-shrink-0`}>
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
              <Search size={12} className="text-gray-400" />
              <input
                type="text" placeholder="Cerca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs focus:outline-none" />
            </div>
            <button onClick={loadEmails} className="p-1.5 rounded hover:bg-gray-100">
              <RefreshCw size={14} className={emailsLoading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
            </button>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setFilterDirection('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${filterDirection === 'all' ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-600'}`}>
              Tutte
            </button>
            <button onClick={() => setFilterDirection('in')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${filterDirection === 'in' ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-600'}`}>
              Ricevute
            </button>
            <button onClick={() => setFilterDirection('out')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${filterDirection === 'out' ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-600'}`}>
              Inviate
            </button>
            <button onClick={() => setShowArchived(!showArchived)}
              className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${showArchived ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
              <Archive size={10} /> Archivio
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {emailsLoading ? (
            <div className="p-6 text-center text-xs text-gray-400">Caricamento…</div>
          ) : visibleEmails.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">Nessuna email</div>
          ) : (
            visibleEmails.map((e) => {
              const isSel = selected?.id === e.id && selected?.kind === e.kind;
              const isUnread = !e.is_read && e.direction === 'ricevuta';
              return (
                <button
                  key={`${e.kind}-${e.id}`}
                  onClick={() => openEmail(e)}
                  className={`w-full text-left border-b border-gray-100 hover:bg-gray-50 px-3 py-2 transition-colors ${isSel ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-2">
                    {isUnread && <Circle size={6} className="fill-blue-500 text-blue-500 mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs truncate flex-1 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {e.direction === 'inviata'
                            ? `→ ${extractEmail((e.recipient_emails || '').split(',')[0])}`
                            : (extractEmail(e.sender_email) || '?')}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{shortDate(e.create_date)}</span>
                      </div>
                      <div className={`text-xs truncate mt-0.5 ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                        {e.subject}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">
                        {e.direction === 'inviata'
                          ? <span className="text-emerald-600">Inviata</span>
                          : <span className="text-blue-600">Ricevuta</span>}
                        {e.matched_alias && <> · <span className="text-violet-600">{e.matched_alias}</span></>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* DETTAGLIO */}
      {selected && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-3 border-b border-gray-200 flex items-center gap-2">
            <button onClick={() => { setSelected(null); setDetail(null); }}
              className="p-1.5 rounded hover:bg-gray-100 flex items-center gap-1 text-xs text-gray-600">
              <ChevronLeft size={16} /> <span className="hidden sm:inline">Torna</span>
            </button>
            <div className="flex-1" />
            {!selected.is_archived ? (
              <button onClick={() => doAction(selected, 'archive')} title="Archivia" className="p-1.5 rounded hover:bg-gray-100">
                <Archive size={14} className="text-gray-600" />
              </button>
            ) : (
              <button onClick={() => doAction(selected, 'unarchive')} title="Ripristina" className="p-1.5 rounded hover:bg-gray-100">
                <Inbox size={14} className="text-gray-600" />
              </button>
            )}
          </div>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              <Loader2 size={16} className="animate-spin mr-2" /> Caricamento…
            </div>
          ) : detail ? (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="text-lg font-bold text-[#1a2744] mb-2">{detail.subject}</h2>
              <div className="text-xs text-gray-500 space-y-0.5 mb-4">
                <div><strong>Da:</strong> {detail.sender_email || '—'}</div>
                <div><strong>A:</strong> {detail.recipient_emails || '—'}</div>
                {detail.cc_emails && <div><strong>CC:</strong> {detail.cc_emails}</div>}
                <div><strong>Data:</strong> {detail.create_date ? new Date(detail.create_date).toLocaleString('it-IT') : '—'}</div>
                {detail.relation_id && (
                  <div>
                    <strong>Progetto:</strong>{' '}
                    <span className="text-[#0f3460]">{detail.relation_name}</span>
                  </div>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="mb-4 p-2 bg-gray-50 rounded">
                  <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Paperclip size={12} /> {attachments.length} allegati
                  </div>
                  {attachments.map(a => (
                    <div key={a.id} className="text-xs text-[#0f3460]">
                      {a.name} ({(a.size / 1024).toFixed(1)} KB)
                    </div>
                  ))}
                </div>
              )}

              <div
                className="prose prose-sm max-w-none text-sm border-t border-gray-100 pt-4"
                dangerouslySetInnerHTML={{ __html: detail.body || '<p class="text-gray-400 italic">(Corpo email non disponibile)</p>' }}
              />

              <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
                <button
                  onClick={() => openReply(selected)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2744] text-white text-xs font-medium hover:bg-[#0f3460]">
                  <Reply size={12} /> Rispondi
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              Errore caricamento
            </div>
          )}
        </div>
      )}
    </div>
  );
}
