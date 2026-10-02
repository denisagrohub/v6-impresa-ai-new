"use client";
import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import ComposerModal from "@/components/admin/email/ComposerModal";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText,
  Brain, Shield, UserCog, Phone, PenTool, FileSignature, Code2,
  Search, RefreshCw, Inbox, Send, Archive,
  Reply, ChevronLeft, ChevronDown, Circle, Paperclip
} from "lucide-react";

type Mailbox = { alias: string; label?: string; total: number; unread: number; lastDate: string | null };
type Email = {
  id: number;
  kind: 'winwin' | 'project';
  name: string;
  sender_email: string;
  recipient_emails: string;
  cc_emails: string;
  direction: 'ricevuta' | 'inviata';
  matched_alias: string;
  relation_id: number | null;
  relation_name: string | null;
  is_read: boolean;
  is_archived: boolean;
  create_date: string | null;
};

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ora";
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

export default function AdminMiaEmailPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeMailbox, setActiveMailbox] = useState<string>('__all__');

  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'in' | 'out'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [selected, setSelected] = useState<Email | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 02/10/2026 (C2-rd): pannello "Chi ha letto" (solo project, admin/chief)
  const [readers, setReaders] = useState<{ recipients: any[]; total: number; read_count: number } | null>(null);
  const [readersOpen, setReadersOpen] = useState(true);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitial, setComposerInitial] = useState({ to: '', cc: '', subject: '', body: '' });

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) { window.location.href = "/login"; return; }
    const u = JSON.parse(session);
    setUser(u);
    loadMailboxes(u);
  }, []);

  const loadMailboxes = async (u?: any) => {
    const session = u || user;
    try {
      const res = await fetch('/api/admin/emails/mailboxes', {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      const p = data.data || data;
      if (!p.success) { setError(p.error || 'Errore'); return; }
      setMailboxes(p.mailboxes || []);
      setTotalUnread(p.totalUnread || 0);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const loadEmails = async () => {
    if (!user) return;
    setEmailsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('mailbox', activeMailbox);
      if (filterDirection === 'in') params.set('direction', 'in');
      if (filterDirection === 'out') params.set('direction', 'out');
      if (showArchived) params.set('archived', '1');
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '200');
      const res = await fetch(`/api/admin/emails?${params}`, {
        headers: { Authorization: `JWT ${user.token}` },
      });
      const data = await res.json();
      const p = data.data || data;
      if (!p.success) { setError(p.error); return; }
      setEmails(p.emails || []);
    } catch (e: any) {
      setError(e.message);
    } finally { setEmailsLoading(false); }
  };

  useEffect(() => {
    if (user) loadEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMailbox, filterDirection, showArchived, user]);

  const openNewCompose = () => {
    setComposerInitial({ to: '', cc: '', subject: '', body: '' });
    setComposerOpen(true);
  };

  const openReply = (email: Email) => {
    const from = email.direction === 'ricevuta' ? extractEmail(email.sender_email) : '';
    const subj = (email.name || '').startsWith('Re:') ? email.name : `Re: ${email.name || ''}`;
    setComposerInitial({ to: from, cc: '', subject: subj, body: '' });
    setComposerOpen(true);
  };

  const openForward = (email: Email, bodyHtml?: string) => {
    const subj = (email.name || '').startsWith('Fwd:') ? email.name : `Fwd: ${email.name || ''}`;
    const quoted = bodyHtml || '';
    setComposerInitial({
      to: '', cc: '', subject: subj,
      body: quoted ? '\n\n---------- Forwarded ----------\n' + quoted : '',
    });
    setComposerOpen(true);
  };

  const openEmail = async (email: Email) => {
    setSelected(email);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/emails/${email.id}?kind=${email.kind}`, {
        headers: { Authorization: `JWT ${user?.token || ''}` },
      });
      const data = await res.json();
      const p = data.data || data;
      if (p.success) setDetail(p.email);
      if (!email.is_read) {
        await fetch(`/api/admin/emails/${email.id}/mark-read?kind=${email.kind}`, {
          method: 'POST',
          headers: { Authorization: `JWT ${user?.token || ''}`, 'Content-Type': 'application/json' },
          body: '{}',
        });
        setEmails(prev => prev.map(e => e.id === email.id && e.kind === email.kind ? { ...e, is_read: true } : e));
        loadMailboxes();
      }
      // 02/10/2026 (C2-rd): solo per project, prova a caricare readers.
      // Se 403 (non admin/chief), silenziosamente non mostra il pannello.
      setReaders(null);
      if (email.kind === 'project') {
        try {
          const rr = await fetch(`/api/admin/emails/${email.id}/readers?kind=${email.kind}`, {
            headers: { Authorization: `JWT ${user?.token || ''}` },
          });
          if (rr.ok) {
            const rd = await rr.json();
            const p = rd.data || rd;
            if (p.recipients) setReaders({ recipients: p.recipients, total: p.total, read_count: p.read_count });
          }
        } catch { /* silenzioso */ }
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setDetailLoading(false); }
  };

  const doAction = async (email: Email, action: 'archive' | 'unarchive' | 'mark-unread') => {
    try {
      await fetch(`/api/admin/emails/${email.id}/${action}?kind=${email.kind}`, {
        method: 'POST',
        headers: { Authorization: `JWT ${user?.token || ''}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      setSelected(null);
      setDetail(null);
      loadEmails();
      loadMailboxes();
    } catch (e: any) { setError(e.message); }
  };



  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <AdminSidebar
        badges={[{ href: '/admin/mia-email', count: totalUnread, color: 'bg-red-500' }]}
        user={user}
      />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-xs font-bold text-[#1a2744] uppercase tracking-wider flex-1">Caselle</h2>
            <button onClick={openNewCompose} title="Nuovo messaggio"
              className="px-2 py-1 rounded bg-[#1a2744] text-white text-[10px] font-medium hover:bg-[#0f3460] flex items-center gap-1">
              <PenTool size={10} /> Nuovo
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-400">…</div>
            ) : (
              mailboxes.map((mb) => {
                const isActive = activeMailbox === mb.alias;
                const isSent = mb.alias === '__sent__';
                const isAll = mb.alias === '__all__';
                const Icon = isSent ? Send : (isAll ? Inbox : Mail);
                const label = mb.label || mb.alias;
                return (
                  <button key={mb.alias}
                    onClick={() => { setActiveMailbox(mb.alias); setSelected(null); setDetail(null); }}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all text-left mb-0.5 ${isActive ? 'bg-[#1a2744] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <Icon size={14} />
                    <span className="flex-1 truncate" title={label}>{label}</span>
                    {mb.unread > 0 && (
                      <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-white text-[#1a2744]' : 'bg-amber-500 text-white'}`}>
                        {mb.unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className={`${selected ? 'w-80' : 'flex-1'} bg-white border-r border-gray-200 flex flex-col flex-shrink-0`}>
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                <Search size={12} className="text-gray-400" />
                <input type="text" placeholder="Cerca..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadEmails()}
                  className="flex-1 bg-transparent text-xs focus:outline-none" />
              </div>
              <button onClick={() => { loadEmails(); loadMailboxes(); }} className="p-1.5 rounded hover:bg-gray-100">
                <RefreshCw size={14} className={emailsLoading ? "animate-spin text-gray-400" : "text-gray-600"} />
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
            ) : emails.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">Nessuna email</div>
            ) : (
              emails.map((e) => {
                const isSel = selected?.id === e.id && selected?.kind === e.kind;
                const isUnread = !e.is_read && e.direction === 'ricevuta';
                return (
                  <button key={`${e.kind}-${e.id}`} onClick={() => openEmail(e)}
                    className={`w-full text-left border-b border-gray-100 hover:bg-gray-50 px-3 py-2 transition-colors ${isSel ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start gap-2">
                      {isUnread && <Circle size={6} className="fill-blue-500 text-blue-500 mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs truncate flex-1 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {e.direction === 'inviata' ? `→ ${extractEmail((e.recipient_emails || '').split(',')[0])}` : (extractEmail(e.sender_email) || '?')}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{shortDate(e.create_date)}</span>
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                          {e.name}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {e.direction === 'inviata' ? <span className="text-emerald-600">Inviata</span> : <span className="text-blue-600">Ricevuta</span>}
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

        {selected && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-3 border-b border-gray-200 flex items-center gap-2">
              <button onClick={() => { setSelected(null); setDetail(null); setReaders(null); }} title="Torna alla lista"
                className="p-1.5 rounded hover:bg-gray-100 flex items-center gap-1 text-xs text-gray-600">
                <ChevronLeft size={16} /> <span className="hidden sm:inline">Torna</span>
              </button>
              <div className="flex-1" />
              <button onClick={() => doAction(selected, 'mark-unread')} title="Segna non letta" className="p-1.5 rounded hover:bg-gray-100">
                <Mail size={14} className="text-gray-600" />
              </button>
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
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Caricamento…</div>
            ) : detail ? (
              <div className="flex-1 overflow-y-auto p-4">
                <h2 className="text-lg font-bold text-[#1a2744] mb-2">{detail.name}</h2>
                <div className="text-xs text-gray-500 space-y-0.5 mb-4">
                  <div><strong>Da:</strong> {detail.sender_email || '—'}</div>
                  <div><strong>A:</strong> {detail.recipient_emails || '—'}</div>
                  {detail.cc_emails && <div><strong>CC:</strong> {detail.cc_emails}</div>}
                  <div><strong>Data:</strong> {detail.create_date ? new Date(detail.create_date).toLocaleString('it-IT') : '—'}</div>
                  {detail.matched_alias && <div><strong>Casella:</strong> <span className="text-violet-600">{detail.matched_alias}</span></div>}
                  {detail.relation_id && (
                    <div><strong>Progetto:</strong> <Link href={`/admin/partner-projects/${detail.relation_id}`} className="text-[#0f3460] hover:underline">{detail.relation_name}</Link></div>
                  )}
                </div>

                {detail.attachments?.length > 0 && (
                  <div className="mb-4 p-2 bg-gray-50 rounded">
                    <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Paperclip size={12} /> {detail.attachments.length} allegati
                    </div>
                    {detail.attachments.map((a: any) => (
                      <a key={a.id} href={`/api/admin/attachments/${a.id}/download`} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-[#0f3460] hover:underline">
                        {a.name} ({(a.size / 1024).toFixed(1)} KB)
                      </a>
                    ))}
                  </div>
                )}

                <div className="prose prose-sm max-w-none text-sm border-t border-gray-100 pt-4"
                  dangerouslySetInnerHTML={{ __html: detail.body_html || '<p class="text-gray-400 italic">(Corpo email non disponibile)</p>' }}
                />

                {/* 02/10/2026 (C2-rd): pannello "Chi ha letto" (solo project + admin/chief) */}
                {readers && readers.total > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setReadersOpen(v => !v)}
                      className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded transition-colors"
                    >
                      <ChevronDown
                        size={14}
                        className={`text-gray-400 transition-transform shrink-0 ${readersOpen ? '' : '-rotate-90'}`}
                      />
                      <Users size={13} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">
                        Chi ha letto
                      </span>
                      <span className="text-[11px] text-gray-400 tabular-nums">
                        ({readers.read_count}/{readers.total})
                      </span>
                    </button>
                    {readersOpen && (
                      <div className="mt-2 space-y-1">
                        {readers.recipients.map((r: any) => (
                          <div key={r.user_id} className="flex items-center gap-2 text-xs px-1">
                            <span className={`shrink-0 ${r.read_at ? 'text-emerald-600' : 'text-gray-300'}`}>
                              {r.read_at ? '✅' : '⬜'}
                            </span>
                            <span className={`flex-1 truncate ${r.read_at ? 'text-gray-700' : 'text-gray-500'}`}>
                              {r.user_name}
                            </span>
                            <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                              {r.read_at
                                ? new Date(r.read_at).toLocaleString('it-IT', {
                                    day: '2-digit', month: '2-digit',
                                    hour: '2-digit', minute: '2-digit',
                                  })
                                : 'non letta'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
                  <button onClick={() => openReply(selected)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2744] text-white text-xs font-medium hover:bg-[#0f3460]">
                    <Reply size={12} /> Rispondi
                  </button>
                  <button onClick={() => openForward(selected, detail.body_html)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium hover:bg-gray-50">
                    Inoltra
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Errore caricamento</div>
            )}
          </div>
        )}
      </div>

      <ComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        user={user}
        initialTo={composerInitial.to}
        initialCc={composerInitial.cc}
        initialSubject={composerInitial.subject}
        initialBody={composerInitial.body}
        onSent={() => { loadEmails(); loadMailboxes(); }}
      />
    </div>
  );
}
