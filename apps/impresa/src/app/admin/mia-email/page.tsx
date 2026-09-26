"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText,
  Brain, Shield, UserCog, Phone, PenTool, FileSignature, Code2,
  Search, RefreshCw, Inbox, Send, Archive,
  Reply, ChevronLeft, Circle, Paperclip
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

  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: '', cc: '', subject: '', body: '' });
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeMsg, setComposeMsg] = useState<string | null>(null);

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

  const openNewCompose = () => {
    setCompose({ to: '', cc: '', subject: '', body: '' });
    setComposeMsg(null);
    setComposeOpen(true);
  };

  const openReply = (email: Email) => {
    const from = email.direction === 'ricevuta' ? extractEmail(email.sender_email) : '';
    const subj = (email.name || '').startsWith('Re:') ? email.name : `Re: ${email.name || ''}`;
    setCompose({ to: from, cc: '', subject: subj, body: '' });
    setComposeMsg(null);
    setComposeOpen(true);
  };

  const openForward = (email: Email, bodyHtml?: string) => {
    const subj = (email.name || '').startsWith('Fwd:') ? email.name : `Fwd: ${email.name || ''}`;
    const quoted = bodyHtml || '';
    setCompose({ to: '', cc: '', subject: subj, body: quoted ? `\n\n---------- Forwarded ----------\n${quoted}` : '' });
    setComposeMsg(null);
    setComposeOpen(true);
  };

  const sendCompose = async () => {
    if (!compose.to.trim() || !compose.subject.trim()) {
      setComposeMsg('Destinatario e oggetto obbligatori');
      return;
    }
    setComposeBusy(true); setComposeMsg(null);
    try {
      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user?.token || ''}` },
        body: JSON.stringify(compose),
      });
      const data = await res.json();
      const p = data.data || data;
      if (!p.success) { setComposeMsg('Errore: ' + (p.error || 'invio fallito')); setComposeBusy(false); return; }
      setComposeMsg('✓ Email inviata');
      setCompose({ to: '', cc: '', subject: '', body: '' });
      setTimeout(() => { setComposeOpen(false); setComposeMsg(null); loadEmails(); loadMailboxes(); }, 1500);
    } catch (e: any) {
      setComposeMsg('Errore: ' + e.message);
    } finally { setComposeBusy(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: FolderKanban, label: "Progetti", href: "/admin/projects" },
    { icon: Users, label: "Progetti Partner", href: "/admin/partner-projects" },
    { icon: PenTool, label: "Firme", href: "/admin/firme" },
    { icon: FileText, label: "Documenti", href: "/admin/documenti" },
    { icon: Code2, label: "Template", href: "/admin/template" },
    { icon: FileSignature, label: "Contratti", href: "/admin/contratti" },
    { icon: UserCog, label: "Team", href: "/admin/team" },
    { icon: Phone, label: "Call Prenotate", href: "/admin/bookings" },
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },
    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Commissioni", href: "/admin/accounting" },
    { icon: Mail, label: "La mia email", href: "/admin/mia-email" },
    { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
    { icon: Shield, label: "Sicurezza", href: "/admin/security" },
    { icon: Settings, label: "Impostazioni", href: "/admin/settings/system" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white text-xs font-bold">PI</div>
            <div>
              <div className="font-bold text-[#1a2744] text-sm">V6 Impresa AI</div>
              <div className="text-xs text-gray-500">Admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item, i) => {
            const isActive = typeof window !== "undefined" && window.location.pathname === item.href;
            return (
              <Link key={i} href={item.href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive ? "bg-[#1a2744] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                <item.icon size={14} /> {item.label}
                {item.href === '/admin/mia-email' && totalUnread > 0 && (
                  <span className="ml-auto min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full">
            <LogOut size={14} /> Esci
          </button>
        </div>
      </aside>

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
              <button onClick={() => { setSelected(null); setDetail(null); }} title="Torna alla lista"
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

      {composeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setComposeOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1a2744] text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
              <h3 className="text-sm font-bold">Nuovo messaggio</h3>
              <button onClick={() => setComposeOpen(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">A *</label>
                <input type="email" value={compose.to}
                  onChange={(e) => setCompose({...compose, to: e.target.value})}
                  placeholder="destinatario@esempio.it"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CC</label>
                <input type="email" value={compose.cc}
                  onChange={(e) => setCompose({...compose, cc: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Oggetto *</label>
                <input type="text" value={compose.subject}
                  onChange={(e) => setCompose({...compose, subject: e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Messaggio</label>
                <textarea value={compose.body}
                  onChange={(e) => setCompose({...compose, body: e.target.value})}
                  rows={10}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-y" />
              </div>
              {composeMsg && (
                <div className={`text-xs p-2 rounded ${composeMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {composeMsg}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setComposeOpen(false)} className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100">
                  Annulla
                </button>
                <button onClick={sendCompose} disabled={composeBusy}
                  className="px-3 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium hover:bg-[#0f3460] disabled:opacity-50 flex items-center gap-1">
                  <Send size={12} /> {composeBusy ? 'Invio…' : 'Invia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
