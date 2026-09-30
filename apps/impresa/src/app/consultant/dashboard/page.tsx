"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, LayoutDashboard, Clock, Euro, AlertTriangle, LogOut, Mail, RefreshCw, Handshake, Building2, Reply, ReplyAll, Forward, Send,
    FolderOpen, Users, AlertCircle, Calendar, Video,
    CheckCircle2, TrendingUp, FileText, PlusCircle, Eye, Check, X, Loader2
, Trash2, Plus, Archive, ArchiveRestore, PenTool, ArrowRight, Download, FileCheck2, BookOpen } from "lucide-react";
import EmailAttachmentsInput from "@/components/EmailAttachmentsInput";
import type { AttachedFile } from "@/components/EmailAttachmentsInput";
import EmailRecipientInput from "@/components/EmailRecipientInput";
import { CalendarWithHeinrich } from "@/components/calendar/CalendarWithHeinrich";
import { ConsultantBookingLinks } from "@/components/booking/ConsultantBookingLinks";
import { DealTimeline } from '@/components/deal/DealTimeline';

export default function ConsultantDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("panoramica");
    const [data, setData] = useState<any>(null);
    const [myRequests, setMyRequests] = useState<any>(null);    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());   const [currentYear, setCurrentYear] = useState(new Date().getFullYear());    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    // 21/09/2026: email assegnate + pagamenti (compensi) del consulente
    const [emailsData, setEmailsData] = useState<any>(null);
    const [emailFolder, setEmailFolder] = useState<"all" | "ricevute" | "inviate">("all");
    const [unreadCount, setUnreadCount] = useState(0);

    // 30/09/2026: overview KPI dashboard (endpoint aggregatore).
    const [overviewKpi, setOverviewKpi] = useState<any>(null);
    const [overviewAlerts, setOverviewAlerts] = useState<any[]>([]);

    // 30/09/2026 (E4): filtri ricerca per tab contestuali.
    const [projectSearch, setProjectSearch] = useState('');
    const [partnerSearch, setPartnerSearch] = useState('');
    const [paymentSearch, setPaymentSearch] = useState('');

    // 30/09/2026 (Step B): checklist deal raggruppate per deal.
    const [dealChecklists, setDealChecklists] = useState<any[]>([]);
    const [dealChecklistsLoading, setDealChecklistsLoading] = useState(false);
    // 23/09/2026: profilo fiscale (form)
    const [fiscalData, setFiscalData] = useState<any>(null);
    const [fiscalForm, setFiscalForm] = useState<any>({ vat:'', codice_fiscale:'', street:'', street2:'', city:'', zip:'', email_mode: 'personal' });
    const [fiscalMsg, setFiscalMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [fiscalSaving, setFiscalSaving] = useState(false);
    const [fiscalDeclaration, setFiscalDeclaration] = useState(false);
    const [emailSearch, setEmailSearch] = useState('');
    const [emailArchivedView, setEmailArchivedView] = useState(false);
    const [emailProjectFilter, setEmailProjectFilter] = useState<string>('');
    const [emailsLoading, setEmailsLoading] = useState(false);
    // 21/09/2026: modal dettaglio email
    const [emailDetail, setEmailDetail] = useState<any>(null);
    const [emailDetailLoading, setEmailDetailLoading] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState<{id:number;name:string;mimetype?:string;size?:number}[]>([]);
    // 21/09/2026: composer reply/forward
    const [composer, setComposer] = useState<any>(null);
    const [composerSending, setComposerSending] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [paymentsData, setPaymentsData] = useState<any>(null);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [partnerProjects, setPartnerProjects] = useState<any>(null);
    const [partnerProjectsLoading, setPartnerProjectsLoading] = useState(false);
    // 25/09/2026: firme del consulente (split, NDA, ...)
    const [signRequests, setSignRequests] = useState<any[]>([]);
    const [signLoading, setSignLoading] = useState(false);

    // Tab "Progetti" e "Richieste" collegati per davvero a Odoo il
    // 25/08/2026 (compito "dashboard consulente", compito 2) - prima
    // mostravano solo data.projects (mock) e bottoni finti senza azione.
    // isAdmin distingue le azioni in piu' del ruolo (compito 3): il filtro
    // sui DATI resta comunque garantito lato Odoo (record rule + controllo
    // esplicito in consultant_api.py), qui e' solo mostra/nascondi azioni.
    const isAdmin = user?.role === 'admin';
    const [projectsData, setProjectsData] = useState<any>(null);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [showAllConsultants, setShowAllConsultants] = useState(false);

    const [richiesteData, setRichiesteData] = useState<any>(null);
    const [richiesteLoading, setRichiesteLoading] = useState(false);
    const [richiesteError, setRichiesteError] = useState<string | null>(null);
    const [decidingId, setDecidingId] = useState<number | null>(null);
    const [newRichiesta, setNewRichiesta] = useState({ leadId: '', tipo: 'assegnami', motivo: '' });
    const [creatingRichiesta, setCreatingRichiesta] = useState(false);

    async function loadProjects() {
        if (!user?.token) return;
        setProjectsLoading(true);
        try {
            const res = await fetch(`/api/consultant/projects${showAllConsultants ? '?all=1' : ''}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Errore caricamento progetti');
            setProjectsData(json);
        } catch (err) {
            console.error('Errore caricamento progetti reali:', err);
            setProjectsData(null);
        } finally {
            setProjectsLoading(false);
        }
    }

    async function loadRichieste() {
        if (!user?.token) return;
        setRichiesteLoading(true);
        setRichiesteError(null);
        try {
            const res = await fetch('/api/consultant/richieste', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Errore caricamento richieste');
            setRichiesteData(json);
        } catch (err: any) {
            console.error('Errore caricamento richieste reali:', err);
            setRichiesteError(err.message || 'Errore caricamento richieste');
        } finally {
            setRichiesteLoading(false);
        }
    }

    async function handleCreateRichiesta(e: React.FormEvent) {
        e.preventDefault();
        if (!user?.token || !newRichiesta.leadId.trim()) return;
        setCreatingRichiesta(true);
        setRichiesteError(null);
        try {
            const res = await fetch('/api/consultant/richieste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user.token}` },
                body: JSON.stringify({
                    lead_id: Number(newRichiesta.leadId),
                    tipo: newRichiesta.tipo,
                    motivo: newRichiesta.motivo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Impossibile creare la richiesta');
            setNewRichiesta({ leadId: '', tipo: 'assegnami', motivo: '' });
            await loadRichieste();
        } catch (err: any) {
            setRichiesteError(err.message || 'Impossibile creare la richiesta');
        } finally {
            setCreatingRichiesta(false);
        }
    }

    async function handleDecideRichiesta(id: number, decision: 'approve' | 'reject') {
        if (!user?.token) return;
        setDecidingId(id);
        setRichiesteError(null);
        try {
            const res = await fetch(`/api/consultant/richieste/${id}/decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user.token}` },
                body: JSON.stringify({ decision }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Decisione non riuscita');
            await loadRichieste();
        } catch (err: any) {
            setRichiesteError(err.message || 'Decisione non riuscita');
        } finally {
            setDecidingId(null);
        }
    }

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        try {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'consultant' && parsed.role !== 'admin') {
                router.push("/login");
                return;
            }
            setUser(parsed);
        } catch (e) {
            router.push("/login");
        } finally {
            setLoading(false);
        }
    }, [router]);

    // 21/09/2026: rimossi i fetch a /api/consultant/dashboard (mock JSON su disco)
    // e /api/consultant/requests (vecchio). I dati arrivano da endpoint reali
    // (projects, richieste, email, pagamenti) sotto.
    useEffect(() => {
        if (user?.clientId) {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'calendario' && user?.clientId) {
            loadCalendarEvents();
        }
    }, [activeTab, user, currentMonth, currentYear]);

    useEffect(() => {
        if (activeTab === 'progetti' && user?.token) {
            loadProjects();
        }
    }, [activeTab, user, showAllConsultants]);

    useEffect(() => {
        if (activeTab === 'richieste' && user?.token) {
            loadRichieste();
        }
    }, [activeTab, user]);

    useEffect(() => {
        if (activeTab === 'email' && user?.token) { loadEmails(); loadUnread(); }
    }, [activeTab, user, emailArchivedView]);

    // 22/09/2026: autorefresh lista email ogni 60s quando la tab e' attiva
    useEffect(() => {
        if (activeTab !== 'email' || !user?.token) return;
        const t = setInterval(() => { loadEmails(); loadUnread(); }, 60000);
        return () => clearInterval(t);
    }, [activeTab, user, emailArchivedView]);

    // 22/09/2026: badge email sul menu, indipendente dalla tab attiva
    useEffect(() => {
        if (!user?.token) return;
        loadUnread();
        const t = setInterval(loadUnread, 60000);
        return () => clearInterval(t);
    }, [user]);

    useEffect(() => {
        if (activeTab === 'pagamenti' && user?.token) loadPayments();
        if (activeTab === 'profilo' && user?.token) loadFiscalData();
    }, [activeTab, user]);

    useEffect(() => {
        if (activeTab === 'partner' && user?.token) loadPartnerProjects();
        if (activeTab === 'firme' && user?.token) loadSignRequests();
    }, [activeTab, user]);

    // 30/09/2026: carica overview KPI aggregati (una fetch, tutti i numeri).
    useEffect(() => {
        if (!user?.token) return;
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/consultant/dashboard-overview', {
                    headers: { Authorization: `JWT ${user.token}` },
                });
                const d = await r.json();
                if (!cancelled && d.success) {
                    setOverviewKpi(d.kpi);
                    setOverviewAlerts(d.alerts || []);
                }
            } catch { /* best effort */ }
        })();
        return () => { cancelled = true; };
    }, [user]);


    const loadCalendarEvents = async () => {
        try {
            const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;
            const res = await fetch(`/api/consultant/calendar?consultantId=${user.clientId || user.id}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            setCalendarEvents(data.events || []);
        } catch (error) {
            console.error('Errore caricamento calendario:', error);
        }
    };

    // 21/09/2026: apri composer reply/forward
    const openComposer = async (emailId: number, mode: 'reply' | 'replyAll' | 'forward') => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${emailId}/reply-data`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            if (!res.ok || d.error) throw new Error(d.error || 'Errore');
            const subject = mode === 'forward' ? (d.subject.replace(/^Re:\s*/i, 'Fwd: ')) : d.subject;
            const orig = (d.original_body || '').trim();
            const body = mode === 'forward'
                ? (orig ? '<br><br><hr><p><b>----- Messaggio inoltrato -----</b></p>' + orig : '')
                : (orig ? '<br><br><hr><p>' + orig + '</p>' : '');
            setComposer({
                in_reply_to_id: emailId,
                from_email: d.from_email,
                to: mode === 'forward' ? '' : (d.to || ''),
                cc: mode === 'replyAll' ? (d.cc || '') : '',
                subject,
                body,
                mode,
            });
            setEmailDetail(null);  // chiudi modal dettaglio
        } catch (e: any) {
            alert(e.message);
        }
    };

    // 21/09/2026: nuova email (composer vuoto)
    const openNewComposer = () => {
        const fromEmail = user?.emailSlug ? `${user.emailSlug}@v6impresa.it` : (user?.email || '');
        const sigKey = `email_signature_${user?.emailSlug || user?.email || 'default'}`;
        const savedSig = typeof window !== 'undefined' ? localStorage.getItem(sigKey) : null;
        setComposer({ mode: 'new', from_email: fromEmail, to: '', cc: '', bcc: '', subject: '', body: savedSig || '' });
    };

    // 21/09/2026: elimina email (DELETE + refresh lista)
    const deleteEmail = async (id: number, subject: string) => {
        if (!user?.token) return;
        if (!confirm(`Eliminare definitivamente "${subject}"?`)) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                alert(d.error || 'Eliminazione fallita');
                return;
            }
            if (emailDetail?.id === id) setEmailDetail(null);
            loadEmails();
        } catch {
            alert('Errore di rete');
        }
    };

    const suggestAIReply = async () => {
        if (!composer?.in_reply_to_id) { alert('Funziona solo su una risposta.'); return; }
        try {
            const res = await fetch('/api/admin/assistant/suggest-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resModel: 'erpv6.winwin.email.log',
                    resId: composer.in_reply_to_id,
                    emailLogId: composer.in_reply_to_id,
                    agentCode: 'susanna',
                }),
            });
            const d = await res.json();
            if (!res.ok || !d.success) { alert(d.error || 'Suggerimento fallito'); return; }
            const draft = typeof d.draft === 'string' ? d.draft : (d.draft?.text || JSON.stringify(d.draft));
            setComposer({ ...composer, body: (composer.body || '') + '<br/><br/>' + draft });
        } catch { alert('Errore di rete'); }
    };

    const sendComposer = async () => {
        if (!user?.token || !composer) return;
        const bodyText = (composer.body || '').replace(/<[^>]*>/g, '').trim();
        if (!composer.to?.trim() || !composer.subject?.trim() || !bodyText) {
            alert('To, oggetto e corpo sono obbligatori');
            return;
        }
        setComposerSending(true);
        try {
            const localFiles = await Promise.all(
                attachedFiles.filter((f) => f.source === 'local' && f.fileRaw).map(async (f) => ({
                    fileName: f.name,
                    mimetype: f.fileRaw!.type,
                    fileBase64: await new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve((r.result as string).split(',')[1] || '');
                        r.onerror = reject;
                        r.readAsDataURL(f.fileRaw!);
                    }),
                }))
            );
            const attachments = [
                ...localFiles,
                ...attachedFiles.filter((f) => f.source === 'library' && f.id).map((f) => ({ attachmentId: f.id })),
            ];
            const res = await fetch('/api/consultant/emails/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `JWT ${user.token}`,
                },
                body: JSON.stringify({ ...composer, attachments }),
            });
            const d = await res.json();
            if (!res.ok || d.error) throw new Error(d.error || 'Invio fallito');
            setComposer(null);
            setAttachedFiles([]);
            loadEmails();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setComposerSending(false);
        }
    };

    // 21/09/2026: apri dettaglio email nel modal
    const archiveEmail = async (id: number) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}/archive`, {
                method: 'POST', headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Archiviazione fallita'); return; }
            if (emailDetail?.id === id) setEmailDetail(null);
            loadEmails();
        } catch { alert('Errore di rete'); }
    };

    const unarchiveEmail = async (id: number) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}/unarchive`, {
                method: 'POST', headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Operazione fallita'); return; }
            loadEmails();
        } catch { alert('Errore di rete'); }
    };

    const openEmailDetail = async (emailId: number) => {
        if (!user?.token) return;
        setEmailDetailLoading(true);
        setEmailDetail({ id: emailId });
        try {
            const res = await fetch(`/api/consultant/emails/${emailId}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Errore');
            setEmailDetail(data);
            fetch(`/api/consultant/emails/${emailId}/attachments`, {
                headers: { Authorization: `JWT ${user.token}` },
            }).then((r) => r.json()).then((d) => setEmailAttachments(d.attachments || [])).catch(() => setEmailAttachments([]));
            // 22/09/2026: marca come letta (best-effort) + refresh lista/badge
            fetch(`/api/consultant/emails/${emailId}/mark-read`, {
                method: 'POST',
                headers: { Authorization: `JWT ${user.token}` },
            }).then(() => { loadEmails(); loadUnread(); }).catch(() => {});
        } catch (e: any) {
            setEmailDetail({ id: emailId, error: e.message });
        } finally {
            setEmailDetailLoading(false);
        }
    };

    // 21/09/2026: email assegnate al consulente via routing slug @v6impresa.it
    const projectOptions = (() => {
        const map = new Map<number, string>();
        (emailsData?.emails || []).forEach((e: any) => {
            if (e.relation_id && e.relation_name) map.set(e.relation_id, e.relation_name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    })();

    const loadEmails = async () => {  // 22/09/2026: dipende da emailArchivedView
        if (!user?.token) return;
        setEmailsLoading(true);
        try {
            const res = await fetch('/api/consultant/emails' + (emailArchivedView ? '?archived=1' : ''), {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Errore caricamento email');
            setEmailsData(data);
        } catch (error) {
            console.error('Errore caricamento email:', error);
            setEmailsData({ emails: [], error: 'Impossibile caricare le email' });
        } finally {
            setEmailsLoading(false);
        }
    };

    // 22/09/2026: carica il numero di email non lette
    const loadUnread = async () => {
        if (!user?.token) return;
        try {
            const res = await fetch('/api/consultant/emails/unread-count', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            setUnreadCount(d.unread || 0);
        } catch { /* best effort */ }
    };

    // 21/09/2026: compensi calcolati dallo split V6 dei progetti
    // 23/09/2026: profilo fiscale consulente
    const loadFiscalData = async () => {
        if (!user?.token) return;
        try {
            const res = await fetch('/api/consultant/me/fiscal-data', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            setFiscalData(d);
            setFiscalForm({
                vat: d.vat || '',
                codice_fiscale: d.codice_fiscale || '',
                street: d.street || '',
                street2: d.street2 || '',
                city: d.city || '',
                zip: d.zip || '',
                email_mode: d.email_mode || 'personal',
            });
        } catch { /* best effort */ }
    };

    const saveFiscalData = async () => {
        if (!user?.token) return;
        setFiscalSaving(true);
        setFiscalMsg(null);
        try {
            const res = await fetch('/api/consultant/me/fiscal-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user.token}` },
                body: JSON.stringify({ ...fiscalForm, declaration_accepted: fiscalDeclaration }),
            });
            const d = await res.json();
            if (!res.ok || d.error) {
                setFiscalMsg({ ok: false, text: d.error || 'Errore nel salvataggio' });
                return;
            }
            setFiscalMsg({ ok: true, text: 'Dati salvati correttamente' });
            loadFiscalData();
        } catch (e: any) {
            setFiscalMsg({ ok: false, text: e.message || 'Errore di rete' });
        } finally { setFiscalSaving(false); }
    };

    const loadPayments = async () => {
        if (!user?.token) return;
        setPaymentsLoading(true);
        try {
            const res = await fetch('/api/consultant/payments', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Errore caricamento pagamenti');
            setPaymentsData(data);
        } catch (error) {
            console.error('Errore caricamento pagamenti:', error);
            setPaymentsData({ payments: [], error: 'Impossibile caricare i pagamenti' });
        } finally {
            setPaymentsLoading(false);
        }
    };

    // 21/09/2026: progetti partner (tracking.relation)
    const loadPartnerProjects = async () => {
        if (!user?.token) return;
        setPartnerProjectsLoading(true);
        try {
            const res = await fetch('/api/consultant/partner-projects', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Errore caricamento progetti partner');
            setPartnerProjects(data);
        } catch (error) {
            console.error('Errore caricamento progetti partner:', error);
            setPartnerProjects({ projects: [], error: 'Impossibile caricare i progetti partner' });
        } finally {
            setPartnerProjectsLoading(false);
        }
    };

    const loadSignRequests = async () => {
        if (!user?.token) return;
        setSignLoading(true);
        try {
            const res = await fetch('/api/consultant/sign-requests', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Errore caricamento firme');
            setSignRequests(data.signRequests || []);
        } catch (error) {
            console.error('Errore caricamento firme:', error);
            setSignRequests([]);
        } finally {
            setSignLoading(false);
        }
        loadDealChecklists();
    };

    // 30/09/2026 (Step B): carica checklist deal (vista per deal).
    const loadDealChecklists = async () => {
        if (!user?.token) return;
        setDealChecklistsLoading(true);
        try {
            const res = await fetch('/api/consultant/deal-checklists', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            setDealChecklists(data.deals || []);
        } catch {
            setDealChecklists([]);
        } finally {
            setDealChecklistsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("pi_session");
        document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        // 24/09/2026 logout fix: cancella anche 'token' (il middleware
        // lo verifica PRIMA di pi_session). Senza questa riga, un
        // logout lasciava un cookie 'token' zombie che il middleware
        // considerava valido -> redirect loop su /login.
        document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = "/login";
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }


    const menuItems = [
        { id: "panoramica", label: "Panoramica", icon: LayoutDashboard },
        { id: "email", label: "Email", icon: Mail },
        { id: "progetti", label: "Progetti Consulenza", icon: FolderOpen },
        { id: "partner", label: "Progetti Partner", icon: Handshake },
        { id: "pagamenti", label: "Pagamenti", icon: Euro },
        { id: "firme", label: "Firme", icon: PenTool },
        { id: "richieste", label: "Richieste", icon: AlertTriangle },
        { id: "calendario", label: "Calendario", icon: Calendar },
        { id: "profilo", label: "Profilo fiscale", icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                            <div className="font-bold text-[#1a2744]">Area Consulente</div>
                            <div className="text-xs text-gray-500 truncate">{user?.name}</div>
                        </div>
                    </div>
                </div>

                {/* 30/09/2026 — Extralusso + lean: link distintivo al
                    catalogo playbook. Separato visivamente dal resto
                    del menu (gradient) perché è un'azione esplorativa
                    ("cosa posso fare"), non operativa ("il mio lavoro
                    quotidiano"). Non tocca il monolite menuItems. */}
                <Link
                    href="/consultant/playbook"
                    className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                               bg-gradient-to-r from-indigo-500 to-purple-600 text-white
                               shadow-lg shadow-indigo-900/20
                               hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-900/30
                               transition-all"
                >
                    <BookOpen size={18} />
                    <span className="flex-1 text-left">Playbook progetti</span>
                    <span className="text-[10px] opacity-80 uppercase tracking-wider">Esplora</span>
                </Link>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                // 30/09/2026: Email è migrata a una pagina
                                // dedicata (/consultant/mia-email) con layout
                                // Gmail identico a admin. Il blocco email
                                // interno (activeTab === 'email') resta come
                                // codice morto — verrà rimosso in cleanup.
                                if (item.id === 'email') {
                                    router.push('/consultant/mia-email');
                                    return;
                                }
                                setActiveTab(item.id);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                                activeTab === item.id 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                            {item.id === 'email' && unreadCount > 0 && (
                                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full"
                    >
                        <LogOut size={18} /> Esci
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-8">

                {/* ═══════════════════════════════════════════════════════
                    OVERVIEW KPI + ALERT (30/09/2026)
                    Strip di orientamento sopra i tab: 5 KPI cliccabili +
                    alert operativi. Nascosta in tab email (che è pagina
                    dedicata) per non duplicare.
                    ═══════════════════════════════════════════════════════ */}

                {/* ═══════════════════════════════════════════════════════
                    HEADER — in Panoramica è ricco (gradient + saluto +
                    data + frase-ponte); negli altri tab è semplice.
                    ═══════════════════════════════════════════════════════ */}
                {activeTab === 'panoramica' ? (
                    (() => {
                        const firstName = (user?.name || '').split(' ')[0] || 'consulente';
                        const personalEmail = user?.emailSlug
                            ? `${user.emailSlug}@v6impresa.it`
                            : (user?.email || '');
                        const todayLabel = new Date().toLocaleDateString('it-IT', {
                            weekday: 'long', day: 'numeric', month: 'long'
                        });
                        const taskCount = overviewAlerts.reduce((s: number, a: any) => s + (a.count || 0), 0);

                        return (
                            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-8 mb-8 text-white shadow-lg shadow-purple-500/20">
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div className="min-w-0">
                                        <h1 className="text-3xl font-bold tracking-tight">
                                            Ciao {firstName} 👋
                                        </h1>
                                        <p className="text-white/80 text-sm mt-1 font-mono truncate">
                                            {personalEmail}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-white/85 capitalize shrink-0">
                                        {todayLabel}
                                    </div>
                                </div>

                                {taskCount > 0 ? (
                                    <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25">
                                        <span className="text-xl">🎯</span>
                                        <span className="text-sm font-medium">
                                            Hai <strong>{taskCount}</strong> {taskCount === 1 ? 'cosa' : 'cose'} da fare oggi. Iniziamo?
                                        </span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25">
                                        <span className="text-xl">✨</span>
                                        <span className="text-sm font-medium">
                                            Tutto sotto controllo. Nessuna azione in attesa.
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })()
                ) : (
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-[#1a2744]">
                            {activeTab === 'progetti' && 'I Miei Progetti Assegnati'}
                            {activeTab === 'partner' && 'Progetti Partner'}
                            {activeTab === 'email' && 'Le Mie Email'}
                            {activeTab === 'pagamenti' && 'I Miei Compensi'}
                            {activeTab === 'firme' && 'Le Mie Firme'}
                            {activeTab === 'richieste' && 'Richieste & Segnalazioni'}
                            {activeTab === 'calendario' && 'Calendario e Rischi'}
                            {activeTab === 'profilo' && 'Profilo fiscale'}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {user?.emailSlug ? `${user.emailSlug}@v6impresa.it` : user?.email}
                        </p>
                    </header>
                )}

                {/* TAB: PROGETTI - collegato per davvero a erpv6.production.order/
                    crm.lead (25/08/2026, compito "dashboard consulente"):
                    prima mostrava solo data.projects (mock, PI-2026-0024/0018
                    hardcoded). "Vedi tutti i consulenti" e' l'azione in piu'
                    riservata a Responsabile/Admin (compito 3) - il filtro sui
                    dati resta comunque garantito lato Odoo. */}
                {/* ═══════════════════════════════════════════════════
                    TAB: PANORAMICA — cosa fare oggi
                    ═══════════════════════════════════════════════════ */}
                {activeTab === 'panoramica' && overviewKpi && (
                    <>
                        {/* Strip contatori orizzontale (compatta) */}
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <button
                                onClick={() => setActiveTab('progetti')}
                                className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all"
                            >
                                <FolderOpen size={16} className="text-blue-600" />
                                <span className="text-lg font-bold text-[#1a2744]">
                                    {overviewKpi.projects.count}
                                </span>
                                <span className="text-xs text-gray-500">Progetti</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('partner')}
                                className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all"
                            >
                                <Handshake size={16} className="text-orange-600" />
                                <span className="text-lg font-bold text-[#1a2744]">
                                    {overviewKpi.partnerProjects.count}
                                </span>
                                <span className="text-xs text-gray-500">Partner</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('firme')}
                                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                                    overviewKpi.signRequestsPending.count > 0
                                        ? 'border-amber-300 bg-amber-50 hover:shadow-sm'
                                        : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm'
                                }`}
                            >
                                <PenTool size={16} className="text-amber-600" />
                                <span className="text-lg font-bold text-[#1a2744]">
                                    {overviewKpi.signRequestsPending.count}
                                </span>
                                <span className="text-xs text-gray-500">Firme</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('pagamenti')}
                                className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all"
                            >
                                <Euro size={16} className="text-emerald-600" />
                                <span className="text-lg font-bold text-[#1a2744]">
                                    {overviewKpi.payments.total.toLocaleString('it-IT', { maximumFractionDigits: 0 })}€
                                </span>
                                <span className="text-xs text-gray-500">Compensi</span>
                            </button>
                        </div>


                    </>
                )}

                {activeTab === "panoramica" && (
                    <div className="space-y-6">

                        {/* Azioni di oggi */}
                        <section>
                            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3 flex items-center gap-1.5">
                                <AlertTriangle size={12} /> Cosa fare oggi
                            </h2>

                            {overviewAlerts.length === 0 ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
                                    <div className="text-3xl mb-2">✨</div>
                                    <p className="text-sm font-medium text-emerald-800">
                                        Tutto sotto controllo — niente da fare adesso.
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-1">
                                        Usa il menu a sinistra per sfogliare progetti, email, firme.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {overviewAlerts.map((a: any, i: number) => {
                                        const handleClick = () => {
                                            if (a.href.startsWith('/consultant/dashboard')) setActiveTab('progetti');
                                            else router.push(a.href);
                                        };
                                        return (
                                            <button
                                                key={i}
                                                onClick={handleClick}
                                                className="w-full flex items-start gap-5 px-5 py-4 rounded-2xl border border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition-all text-left group"
                                            >
                                                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 text-2xl">
                                                    {a.icon || '⚠️'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 mb-0.5">
                                                        <span className="text-2xl font-bold text-amber-900 leading-none">
                                                            {a.count}
                                                        </span>
                                                        <span className="text-base font-semibold text-[#1a2744]">
                                                            {a.action || a.label}
                                                        </span>
                                                    </div>
                                                    {a.hint && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {a.hint}
                                                        </p>
                                                    )}
                                                </div>
                                                <ArrowRight
                                                    size={20}
                                                    className="text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 mt-4"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Azioni rapide */}
                        <section>
                            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
                                Azioni rapide
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Link
                                    href="/consultant/nuovo-lead"
                                    className="group flex flex-col gap-3 p-5 rounded-2xl border border-gray-200 bg-white hover:border-orange-300 hover:shadow-md transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <PlusCircle size={20} className="text-orange-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-[#1a2744]">Nuovo cliente</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Avvia un'intervista</div>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => setActiveTab('progetti')}
                                    className="group flex flex-col gap-3 p-5 rounded-2xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FolderOpen size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-[#1a2744]">I miei progetti</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Lavori in corso</div>
                                    </div>
                                </button>
                                <Link
                                    href="/consultant/playbook"
                                    className="group flex flex-col gap-3 p-5 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <BookOpen size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-[#1a2744]">Playbook</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Catalogo progetti</div>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => router.push('/consultant/mia-email')}
                                    className="group flex flex-col gap-3 p-5 rounded-2xl border border-gray-200 bg-white hover:border-red-300 hover:shadow-md transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Mail size={20} className="text-red-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-[#1a2744]">La mia email</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Casella di lavoro</div>
                                    </div>
                                </button>
                            </div>
                        </section>

                    </div>
                )}

                {activeTab === "progetti" && (
                    <div className="space-y-6">
                        {/* E4: barra contestuale (counters + search + CTA) */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="font-bold text-[#1a2744]">{projectsData?.orders?.length ?? 0}</span>
                                    <span className="text-gray-500">in lavorazione</span>
                                </span>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                    <span className="font-bold text-[#1a2744]">{projectsData?.leads_senza_produzione?.length ?? 0}</span>
                                    <span className="text-gray-500">da qualificare</span>
                                </span>
                            </div>

                            <div className="flex-1"></div>

                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca nome o cliente…"
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                    className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-56 focus:border-blue-400 focus:outline-none"
                                />
                            </div>

                            {isAdmin && (
                                <label className="inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={showAllConsultants}
                                        onChange={(e) => setShowAllConsultants(e.target.checked)}
                                    />
                                    <Eye size={14} /> Tutti
                                </label>
                            )}

                            <Link
                                href="/consultant/nuovo-lead"
                                className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-orange-600 transition-colors text-sm"
                            >
                                <PlusCircle size={16} /> Nuovo cliente
                            </Link>
                        </div>

                        {projectsLoading && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico i progetti da Odoo...
                            </div>
                        )}

                        {!projectsLoading && projectsData && projectsData.orders.length === 0 && projectsData.leads_senza_produzione.length === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                Nessun progetto reale trovato{showAllConsultants ? '' : ' per te'}. Avvia un'intervista per un nuovo cliente per crearne uno.
                            </div>
                        )}

                        {!projectsLoading && !projectsData && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
                                Impossibile caricare i progetti reali da Odoo in questo momento.
                            </div>
                        )}

                        {projectsData && projectsData.orders.length > 0 && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {projectsData.orders
                                    .filter((proj: any) => {
                                        if (!projectSearch.trim()) return true;
                                        const q = projectSearch.toLowerCase();
                                        return (proj.name || '').toLowerCase().includes(q)
                                            || (proj.client || '').toLowerCase().includes(q);
                                    })
                                    .map((proj: any) => (
                                    <div key={proj.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                                        <div className="flex justify-between items-start mb-4 gap-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(proj.ruoli_miei || []).map((r: string) => (
                                                    <span key={r} className="text-xs px-2 py-1 rounded-full font-bold bg-blue-100 text-blue-700">{r}</span>
                                                ))}
                                                {proj.verticale && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{proj.verticale}</span>
                                                )}
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                                {proj.phase || 'senza fase'}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-[#1a2744] mb-1">{proj.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Cliente: {proj.client || '—'}
                                            {showAllConsultants && proj.consulente && (
                                                <span className="ml-2 text-xs text-gray-400">· Consulente: {proj.consulente}</span>
                                            )}
                                        </p>
                                        <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-4">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Clock size={16} />
                                                <span>Lead #{proj.lead_id}</span>
                                            </div>
                                            <Link href={`/consultant/project-progress?id=${proj.id}`} className="text-blue-600 font-medium hover:underline flex items-center gap-1">
                                                Vedi dettagli →
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {projectsData && projectsData.leads_senza_produzione.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                                    Lead senza produzione avviata (intervista non ancora completata)
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {projectsData.leads_senza_produzione
                                        .filter((lead: any) => {
                                            if (!projectSearch.trim()) return true;
                                            const q = projectSearch.toLowerCase();
                                            return (lead.name || '').toLowerCase().includes(q)
                                                || (lead.client || '').toLowerCase().includes(q);
                                        })
                                        .map((lead: any) => (
                                        <div key={lead.id} className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-[#1a2744]">{lead.name}</span>
                                                <span className="text-xs text-gray-400">Lead #{lead.id}</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">Cliente: {lead.client || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: PROGETTI PARTNER (21/09/2026) */}
                {activeTab === "partner" && (
                    <div className="space-y-4">
                        {/* E4: barra contestuale (counters + search + aggiorna) */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span className="font-bold text-[#1a2744]">{partnerProjects?.projects?.length ?? 0}</span>
                                    <span className="text-gray-500">progetti</span>
                                </span>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="font-bold text-[#1a2744]">
                                        {(partnerProjects?.projects || []).filter((p: any) => p.state === 'attivo').length}
                                    </span>
                                    <span className="text-gray-500">attivi</span>
                                </span>
                            </div>

                            <div className="flex-1"></div>

                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca progetto…"
                                    value={partnerSearch}
                                    onChange={(e) => setPartnerSearch(e.target.value)}
                                    className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-56 focus:border-blue-400 focus:outline-none"
                                />
                            </div>

                            <button
                                onClick={loadPartnerProjects}
                                disabled={partnerProjectsLoading}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-blue-300 disabled:opacity-50"
                            >
                                {partnerProjectsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Aggiorna
                            </button>
                        </div>

                        {partnerProjectsLoading && !partnerProjects && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico i progetti partner...
                            </div>
                        )}

                        {partnerProjects && partnerProjects.projects?.length === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                Nessun progetto partner assegnato. Quando sarai inserito in un progetto (owner, access o Split V6), lo vedrai qui.
                            </div>
                        )}

                        {partnerProjects && partnerProjects.projects
                            ?.filter((p: any) => {
                                if (!partnerSearch.trim()) return true;
                                return (p.name || '').toLowerCase().includes(partnerSearch.toLowerCase());
                            })
                            .map((p: any) => (
                            <Link
                                key={p.id}
                                href={`/consultant/partner-projects/${p.id}`}
                                className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-300 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#1a2744] flex items-center gap-2">
                                            <Building2 size={16} className="text-gray-400" />
                                            {p.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {p.targets_count} target
                                            {p.email_alias && (
                                                <>
                                                    <span className="mx-2 text-gray-300">·</span>
                                                    <span className="font-mono text-xs">{p.email_alias}@v6sviluppoimpresa.it</span>
                                                </>
                                            )}
                                            {p.owner_name && (
                                                <>
                                                    <span className="mx-2 text-gray-300">·</span>
                                                    Owner: {p.owner_name}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            p.state === 'attivo' ? 'bg-green-100 text-green-700' :
                                            p.state === 'archiviato' ? 'bg-gray-100 text-gray-600' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {p.state}
                                        </span>
                                        {p.has_split && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                p.split_approvato ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {p.split_approvato ? 'Split approvato' : 'Split bozza'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* TAB: EMAIL (21/09/2026) */}
                {activeTab === "email" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Posta personale su <span className="font-mono">{user?.emailSlug || '—'}@v6impresa.it</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={openNewComposer}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                                >
                                    <Plus size={14} /> Nuova email
                                </button>
                                <button
                                    onClick={loadEmails}
                                    disabled={emailsLoading}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {emailsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Aggiorna
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1 border-b border-gray-200 flex-1 min-w-[300px]">
                                {(["all", "ricevute", "inviate"] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => { setEmailFolder(f); setEmailArchivedView(false); }}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                            !emailArchivedView && emailFolder === f
                                                ? "border-blue-600 text-blue-700"
                                                : "border-transparent text-gray-500 hover:text-gray-800"
                                        }`}
                                    >
                                        {f === "all" ? "Tutte" : f === "ricevute" ? "Ricevute" : "Inviate"}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setEmailArchivedView(true)}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                        emailArchivedView
                                            ? "border-blue-600 text-blue-700"
                                            : "border-transparent text-gray-500 hover:text-gray-800"
                                    }`}
                                >
                                    Archiviate
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Cerca oggetto o mittente…"
                                value={emailSearch}
                                onChange={(ev) => setEmailSearch(ev.target.value)}
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-56"
                            />
                            {projectOptions.length > 0 && (
                                <select
                                    value={emailProjectFilter}
                                    onChange={(ev) => setEmailProjectFilter(ev.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm max-w-[220px]"
                                >
                                    <option value="">Tutti i progetti</option>
                                    {projectOptions.map((p) => (
                                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {emailsLoading && !emailsData && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico le email...
                            </div>
                        )}

                        {emailsData && emailsData.emails?.length === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                Nessuna email ricevuta sul tuo indirizzo.
                            </div>
                        )}

                        {emailsData && emailsData.emails?.filter((e: any) => {
                            const q = emailSearch.trim().toLowerCase();
                            const matchesSearch = !q || (e.subject || '').toLowerCase().includes(q) || (e.sender_email || '').toLowerCase().includes(q);
                            const matchesProject = !emailProjectFilter || String(e.relation_id || '') === emailProjectFilter;
                            if (emailArchivedView) return matchesSearch && matchesProject;
                            const matchesFolder = emailFolder === "all" || e.direction === emailFolder;
                            return matchesSearch && matchesFolder && matchesProject;
                        }).map((e: any) => (
                            <div
                                key={e.id}
                                className="w-full bg-white rounded-2xl border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all flex items-stretch"
                            >
                            <button
                                onClick={() => openEmailDetail(e.id)}
                                className="flex-1 text-left p-5 cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#1a2744] truncate flex items-center gap-2">
                                            {!e.is_read && e.direction === 'ricevuta' && (
                                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                            )}
                                            <span className="truncate">{e.subject}</span>
                                            {e.has_attachments && <span title="Contiene allegati">📎</span>}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1 truncate">
                                            Da: <span className="font-medium">{e.sender_email}</span>
                                        </p>
                                        {e.relation_name && (
                                            <span className="inline-flex items-center gap-1 mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                                <FolderOpen size={11} /> {e.relation_name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">
                                        {e.create_date ? new Date(e.create_date + (e.create_date.endsWith('Z') || e.create_date.includes('+') ? '' : 'Z')).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </span>
                                </div>
                            </button>
                            {!emailArchivedView ? (
                                <button
                                    onClick={(ev) => { ev.stopPropagation(); archiveEmail(e.id); }}
                                    title="Archivia"
                                    className="px-3 flex items-center text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                >
                                    <Archive size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={(ev) => { ev.stopPropagation(); unarchiveEmail(e.id); }}
                                    title="Ripristina"
                                    className="px-3 flex items-center text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                >
                                    <ArchiveRestore size={16} />
                                </button>
                            )}
                            <button
                                onClick={(ev) => { ev.stopPropagation(); deleteEmail(e.id, e.subject); }}
                                title="Elimina definitivamente"
                                className="px-4 flex items-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-r-2xl"
                            >
                                <Trash2 size={16} />
                            </button>
                            </div>
                        ))}
                    </div>
                )}

                
                {/* TAB: PAGAMENTI (21/09/2026) */}
                {activeTab === "firme" && (
                    <div className="space-y-6">
                        {/* E4.3 + Step B: barra contestuale Firme con contatori deal */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span className="font-bold text-[#1a2744]">{dealChecklists.length}</span>
                                    <span className="text-gray-500">deal</span>
                                </span>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span className="font-bold text-[#1a2744]">
                                        {dealChecklists.reduce((sum: number, d: any) =>
                                            sum + d.steps.filter((s: any) => s.status === 'pending' || s.status === 'in_progress').length, 0)}
                                    </span>
                                    <span className="text-gray-500">step aperti</span>
                                </span>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="font-bold text-[#1a2744]">
                                        {dealChecklists.reduce((sum: number, d: any) =>
                                            sum + d.steps.filter((s: any) => s.status === 'done').length, 0)}
                                    </span>
                                    <span className="text-gray-500">completati</span>
                                </span>
                            </div>
                            <div className="flex-1"></div>
                            <button
                                onClick={loadSignRequests}
                                disabled={signLoading || dealChecklistsLoading}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-blue-300 disabled:opacity-50"
                            >
                                {(signLoading || dealChecklistsLoading) ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Aggiorna
                            </button>
                        </div>

                        {/* Stato vuoto */}
                        {dealChecklists.length === 0 && !dealChecklistsLoading && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                                <FileCheck2 size={36} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-sm font-medium text-gray-600">Nessuna checklist attiva sui tuoi deal.</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    I documenti che dovrai firmare appariranno qui, organizzati per deal.
                                </p>
                            </div>
                        )}

                        {/* Vista per deal */}
                        {dealChecklists.map((deal: any) => {
                            const pct = deal.progress?.pct || 0;
                            return (
                                <div key={deal.dealId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-transparent border-b border-gray-100">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Building2 size={18} className="text-blue-600 shrink-0" />
                                                <h3 className="font-bold text-[#1a2744] truncate">{deal.dealName}</h3>
                                                {deal.dealSchema && (
                                                    <span className="text-xs text-gray-400 hidden md:inline">{deal.dealSchema}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-xs text-gray-500">
                                                    <span className="font-bold text-[#1a2744]">{deal.progress.done}</span>/{deal.progress.total} completati
                                                </div>
                                                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-1.5">
                                        {deal.steps.map((step: any) => {
                                            const isDone = step.status === 'done';
                                            const isReady = step.isReady && !isDone;
                                            const isLocked = !isReady && !isDone;
                                            const sr = step.signRequest;
                                            const canSign = isReady && sr && sr.requestUrl
                                                && (sr.status === 'sent' || sr.status === 'viewed' || sr.status === 'draft');

                                            return (
                                                <div
                                                    key={step.id}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                        isDone ? 'bg-emerald-50/50' :
                                                        isReady ? 'bg-amber-50 border border-amber-200' :
                                                        'bg-gray-50/50'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                                        isDone ? 'bg-emerald-500 text-white' :
                                                        isReady ? 'bg-amber-500 text-white' :
                                                        'bg-gray-200 text-gray-400'
                                                    }`}>
                                                        {isDone ? '✓' : isReady ? '!' : '🔒'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-semibold ${isDone ? 'text-gray-500' : 'text-[#1a2744]'}`}>
                                                            {step.label}
                                                        </div>
                                                        {isLocked && step.requiresCodes && (
                                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                                Si sblocca dopo: {step.requiresCodes.replace(/_/g, ' ')}
                                                            </div>
                                                        )}
                                                        {isDone && sr?.signedAt && (
                                                            <div className="text-[11px] text-emerald-600 mt-0.5">
                                                                Firmato il {new Date(sr.signedAt).toLocaleDateString('it-IT')}
                                                            </div>
                                                        )}
                                                        {isReady && sr && (sr.status === 'sent' || sr.status === 'viewed') && (
                                                            <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                                                                In attesa della tua firma
                                                            </div>
                                                        )}
                                                    </div>
                                                    {canSign && (
                                                        <a
                                                            href={sr.requestUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 shrink-0"
                                                        >
                                                            <PenTool size={12} /> Firma
                                                        </a>
                                                    )}
                                                    {isDone && (
                                                        <span className="text-[10px] text-emerald-600 font-medium shrink-0 uppercase tracking-wider">
                                                            Completato
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* 30/09/2026 (F1 S5): timeline dei deal visibili */}
                        {dealChecklists.length > 0 && (
                            <section className="mt-6 space-y-4">
                                <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1.5">
                                    📖 Storia recente
                                </h2>
                                {dealChecklists.map((deal: any) => (
                                    <DealTimeline
                                        key={`timeline-${deal.dealId}`}
                                        dealId={deal.dealId}
                                        mode="consultant"
                                        authToken={user?.token || ''}
                                    />
                                ))}
                            </section>
                        )}

                    </div>
                )}

                {activeTab === "pagamenti" && (
                    <div className="space-y-4">
                        {/* E4.4: barra contestuale Pagamenti */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="font-bold text-[#1a2744]">{paymentsData?.reali?.length ?? 0}</span>
                                    <span className="text-gray-500">reali</span>
                                </span>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span className="font-bold text-[#1a2744]">{paymentsData?.previsioni?.length ?? 0}</span>
                                    <span className="text-gray-500">previsioni</span>
                                </span>
                            </div>

                            <div className="flex-1"></div>

                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca progetto…"
                                    value={paymentSearch}
                                    onChange={(e) => setPaymentSearch(e.target.value)}
                                    className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-56 focus:border-blue-400 focus:outline-none"
                                />
                            </div>

                            <button
                                onClick={loadPayments}
                                disabled={paymentsLoading}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-blue-300 disabled:opacity-50"
                            >
                                {paymentsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Aggiorna
                            </button>
                        </div>

                        {paymentsLoading && !paymentsData && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico i compensi...
                            </div>
                        )}

                        {paymentsData && (paymentsData.reali?.length ?? 0) === 0 && (paymentsData.previsioni?.length ?? 0) === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                Nessun compenso ancora. I deal dove sei beneficiaria appariranno qui quando attivati.
                            </div>
                        )}

                        {/* ─── SEZIONE 1: COMPENSI REALI ─────────────────────── */}
                        {paymentsData && (paymentsData.reali?.length ?? 0) > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs uppercase tracking-wider text-emerald-600 font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Compensi reali ({paymentsData.reali.length})
                                </h2>
                                {paymentsData.reali
                                    .filter((r: any) => {
                                        if (!paymentSearch.trim()) return true;
                                        return (r.deal_name || '').toLowerCase().includes(paymentSearch.toLowerCase());
                                    })
                                    .map((r: any) => {
                                        const fmtEur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
                                        const stato = (r.pagamento_stato || '').replace(/_/g, ' ');
                                        const statoColor = r.pagato ? 'bg-emerald-100 text-emerald-700'
                                            : r.pagamento_stato === 'attesa_fattura' ? 'bg-amber-100 text-amber-800'
                                            : r.giorni_ritardo > 0 ? 'bg-red-100 text-red-700'
                                            : 'bg-blue-100 text-blue-700';
                                        return (
                                            <div key={r.id} className="bg-white rounded-2xl border border-emerald-200 p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-[#1a2744] flex items-center gap-2">
                                                            {r.deal_name}
                                                            {r.periodo && (
                                                                <span className="text-xs font-normal text-gray-400">· {r.periodo}</span>
                                                            )}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            Share: <span className="font-medium">{r.share_pct.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%</span>
                                                            {r.importo_sbloccato > 0 && (
                                                                <>
                                                                    <span className="mx-2 text-gray-300">·</span>
                                                                    Sbloccato: <span className="font-medium">{fmtEur(r.importo_sbloccato)}</span>
                                                                </>
                                                            )}
                                                            {r.giorni_ritardo > 0 && (
                                                                <>
                                                                    <span className="mx-2 text-gray-300">·</span>
                                                                    <span className="text-red-600 font-medium">{r.giorni_ritardo}gg ritardo</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-emerald-700 whitespace-nowrap">
                                                            {fmtEur(r.importo_effettivo)}
                                                        </div>
                                                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${statoColor}`}>
                                                            {stato || 'n/d'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </section>
                        )}

                        {/* ─── SEZIONE 2: PREVISIONI (template, collassabile) ── */}
                        {paymentsData && (paymentsData.previsioni?.length ?? 0) > 0 && (
                            <details className="bg-amber-50/50 rounded-2xl border border-amber-200">
                                <summary className="px-5 py-4 cursor-pointer flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span className="font-semibold text-amber-900">
                                        Previsioni di progetto ({paymentsData.previsioni.length})
                                    </span>
                                    <span className="text-xs text-amber-700 font-normal">
                                        — pagato solo se il deal si chiude
                                    </span>
                                </summary>
                                <div className="px-5 pb-5 space-y-3">
                                    {paymentsData.previsioni
                                        .filter((p: any) => {
                                            if (!paymentSearch.trim()) return true;
                                            return (p.project_name || '').toLowerCase().includes(paymentSearch.toLowerCase());
                                        })
                                        .map((p: any) => (
                                            <div key={p.project_id} className="bg-white rounded-2xl border border-gray-200 p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-[#1a2744]">{p.project_name}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            Base: <span className="font-medium">
                                                                {typeof p.base_valore === 'number'
                                                                    ? p.base_valore.toLocaleString('it-IT')
                                                                    : p.base_valore}
                                                            </span>{' '}
                                                            {p.base_tipo === 'fisso_unita' ? `EUR / ${p.base_unita || 'unità'}` : '% sul valore'}
                                                            <span className="mx-2 text-gray-300">·</span>
                                                            Mia quota: <span className="font-medium">
                                                                {typeof p.mia_pct === 'number'
                                                                    ? p.mia_pct.toLocaleString('it-IT')
                                                                    : p.mia_pct}%
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-amber-700 whitespace-nowrap">
                                                            {typeof p.mia_quota_teorica === 'number'
                                                                ? p.mia_quota_teorica.toLocaleString('it-IT', { maximumFractionDigits: 2 })
                                                                : String(p.mia_quota_teorica).replace('.', ',')}
                                                            {p.base_tipo === 'fisso_unita' ? ` € / ${p.base_unita || 'u'}` : ' %'}
                                                        </div>
                                                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                                                            p.split_approvato ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {p.split_approvato ? 'Approvato' : 'Bozza'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}

                {/* TAB: RICHIESTE - collegato per davvero a
                    erpv6.consulente.richiesta (25/08/2026, compito "dashboard
                    consulente"): prima erano due bottoni finti senza azione.
                    Approva/Rifiuta e' l'azione in piu' riservata a
                    Responsabile/Admin (compito 3, projectsData.can_decide) -
                    il controllo VERO resta comunque lato Odoo
                    (action_approve/action_reject), mai solo qui. */}
                {activeTab === "richieste" && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-[#1a2744] mb-4">Nuova richiesta su un lead</h3>
                            <form onSubmit={handleCreateRichiesta} className="grid md:grid-cols-4 gap-3 items-start">
                                <input
                                    type="number"
                                    placeholder="ID lead"
                                    required
                                    value={newRichiesta.leadId}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, leadId: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200"
                                />
                                <select
                                    value={newRichiesta.tipo}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, tipo: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200"
                                >
                                    <option value="assegnami">Vorrei essere assegnato</option>
                                    <option value="non_assegnarmi">Preferirei non essere assegnato</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Motivo (facoltativo)"
                                    value={newRichiesta.motivo}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, motivo: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200 md:col-span-1"
                                />
                                <button
                                    type="submit"
                                    disabled={creatingRichiesta || !newRichiesta.leadId.trim()}
                                    className="bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 px-4 py-2 disabled:opacity-50"
                                >
                                    {creatingRichiesta ? 'Invio...' : 'Invia richiesta'}
                                </button>
                            </form>
                        </div>

                        {richiesteError && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{richiesteError}</div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-4">
                                    <h3 className="font-bold text-lg">
                                        {richiesteData?.can_decide ? 'Tutte le richieste' : 'Le mie richieste'}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                            <span className="font-bold text-[#1a2744]">
                                                {(richiesteData?.richieste || []).filter((r: any) => r.state === 'in_attesa').length}
                                            </span>
                                            <span className="text-gray-500">in attesa</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span className="font-bold text-[#1a2744]">
                                                {(richiesteData?.richieste || []).filter((r: any) => r.state === 'approvata').length}
                                            </span>
                                            <span className="text-gray-500">approvate</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                            <span className="font-bold text-[#1a2744]">
                                                {(richiesteData?.richieste || []).filter((r: any) => r.state === 'rifiutata').length}
                                            </span>
                                            <span className="text-gray-500">rifiutate</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {richiesteLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
                                    <button
                                        onClick={loadRichieste}
                                        disabled={richiesteLoading}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-blue-300 disabled:opacity-50"
                                    >
                                        {richiesteLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Aggiorna
                                    </button>
                                </div>
                            </div>
                            {richiesteData && richiesteData.richieste.length === 0 && (
                                <div className="p-6 text-center text-gray-500 text-sm">Nessuna richiesta trovata.</div>
                            )}
                            {richiesteData && richiesteData.richieste.length > 0 && (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            {richiesteData.can_decide && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consulente</th>
                                            )}
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Richiesta</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                                            {richiesteData.can_decide && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {richiesteData.richieste.map((r: any) => (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                {richiesteData.can_decide && (
                                                    <td className="px-6 py-4 text-sm text-gray-900">{r.consulente}</td>
                                                )}
                                                <td className="px-6 py-4 text-sm font-medium text-[#1a2744]">
                                                    {r.lead_name} <span className="text-gray-400">#{r.lead_id}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {r.tipo === 'assegnami' ? 'Vorrei essere assegnato' : 'Preferirei non essere assegnato'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={r.motivo}>{r.motivo || '—'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                        r.state === 'approvata' ? 'bg-green-100 text-green-700'
                                                        : r.state === 'rifiutata' ? 'bg-red-100 text-red-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {r.state === 'approvata' ? 'Approvata' : r.state === 'rifiutata' ? 'Rifiutata' : 'In attesa'}
                                                    </span>
                                                </td>
                                                {richiesteData.can_decide && (
                                                    <td className="px-6 py-4">
                                                        {r.state === 'in_attesa' ? (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    disabled={decidingId === r.id}
                                                                    onClick={() => handleDecideRichiesta(r.id, 'approve')}
                                                                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                                                    title="Approva"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    disabled={decidingId === r.id}
                                                                    onClick={() => handleDecideRichiesta(r.id, 'reject')}
                                                                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                                                    title="Rifiuta"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">{r.responsabile ? `da ${r.responsabile}` : '—'}</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: CALENDARIO */}
                {activeTab === "profilo" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Il mio profilo fiscale</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Questi dati vengono usati negli accordi di split firmati digitalmente.
                            Compila con attenzione: la dichiarazione è vincolante.
                        </p>
                        {fiscalData?.confirmed_at && (
                            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
                                Confermato il {new Date(fiscalData.confirmed_at).toLocaleString('it-IT')}
                                {fiscalData.confirmed_ip && <span className="text-emerald-600"> · IP {fiscalData.confirmed_ip}</span>}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Codice Fiscale *</label>
                                <input type="text" maxLength={16} value={fiscalForm.codice_fiscale}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, codice_fiscale: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono uppercase" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">P.IVA (opzionale)</label>
                                <input type="text" maxLength={11} value={fiscalForm.vat}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, vat: e.target.value.replace(/\D/g,'') })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Indirizzo *</label>
                                <input type="text" value={fiscalForm.street}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, street: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Indirizzo (riga 2)</label>
                                <input type="text" value={fiscalForm.street2}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, street2: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Città *</label>
                                <input type="text" value={fiscalForm.city}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, city: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">CAP *</label>
                                <input type="text" maxLength={5} value={fiscalForm.zip}
                                    onChange={(e) => setFiscalForm({ ...fiscalForm, zip: e.target.value.replace(/\D/g,'') })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
                            </div>
                        </div>
                        {/* 27/09/2026: preferenza email */}
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <label className="block text-xs font-semibold text-gray-600 mb-2">
                                Preferenza invio email di sistema
                            </label>
                            <p className="text-[10px] text-gray-500 mb-3">
                                Dove vuoi ricevere le notifiche (firme, split, reminder)?
                            </p>
                            <div className="space-y-2">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" name="email_mode" value="personal"
                                        checked={(fiscalForm.email_mode || 'personal') === 'personal'}
                                        onChange={(e) => setFiscalForm({ ...fiscalForm, email_mode: e.target.value })}
                                        className="mt-0.5" />
                                    <div>
                                        <div className="text-xs font-medium">Solo email personale</div>
                                        <div className="text-[10px] text-gray-500">Ricevi tutto sulla tua email privata (default).</div>
                                    </div>
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" name="email_mode" value="v6"
                                        checked={fiscalForm.email_mode === 'v6'}
                                        onChange={(e) => setFiscalForm({ ...fiscalForm, email_mode: e.target.value })}
                                        className="mt-0.5" />
                                    <div>
                                        <div className="text-xs font-medium">Solo alias V6</div>
                                        <div className="text-[10px] text-gray-500">Tutte le notifiche arrivano all'alias V6 (nome.cognome@v6impresa.it).</div>
                                    </div>
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" name="email_mode" value="both"
                                        checked={fiscalForm.email_mode === 'both'}
                                        onChange={(e) => setFiscalForm({ ...fiscalForm, email_mode: e.target.value })}
                                        className="mt-0.5" />
                                    <div>
                                        <div className="text-xs font-medium">Entrambe (personale + V6 in CC)</div>
                                        <div className="text-[10px] text-gray-500">Massima copertura.</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <label className="flex items-start gap-2 mt-5 cursor-pointer">
                            <input type="checkbox" checked={fiscalDeclaration} onChange={(e) => setFiscalDeclaration(e.target.checked)} className="mt-0.5" />
                            <span className="text-xs text-gray-700">
                                <b>Dichiaro che i dati sopra sono veritieri e completi.</b> Sono consapevole che verranno usati per la generazione di documenti contrattuali a mio nome.
                            </span>
                        </label>
                        {fiscalMsg && (
                            <div className={`mt-4 rounded-lg px-3 py-2 text-xs ${fiscalMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                                {fiscalMsg.text}
                            </div>
                        )}
                        <div className="mt-5 flex items-center justify-between">
                            <a href="https://erp.v6sviluppoimpresa.it/my/account" target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline">
                                Modifica profilo completo su portale Odoo →
                            </a>
                            <button onClick={saveFiscalData} disabled={fiscalSaving || !fiscalDeclaration}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                                {fiscalSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                                Salva dati fiscali
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "calendario" && (
                    <div className="space-y-6">
                        {/* Collegato per davvero a Odoo il 25/08/2026 (Denis:
                            "la parte da salvare e' sicuramente la call") -
                            erpv6.booking.token reale, non piu' un JSON su
                            disco. Vedi report: il modello reale non ha
                            giorno/ora, e' un link monouso con scadenza. */}
                        <ConsultantBookingLinks consultantId={user?.bookingConsultantId ?? null} token={user?.token} />
                        {/* CalendarWithHeinrich resta un widget SEPARATO e
                            ancora 100% con dati finti hardcoded (scadenze/
                            review/rischio progetto) - non riguarda la
                            prenotazione call, non toccato in questo giro
                            (solo analisi, vedi report). */}
                        <CalendarWithHeinrich />
                    </div>
                )}

            {/* MODAL COMPOSER REPLY/FORWARD (21/09/2026) */}
            {composer && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !composerSending && setComposer(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* HEADER */}
                        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                            <h3 className="text-base font-bold text-[#1a2744]">
                                {composer.mode === 'new' ? 'Nuova email' : composer.mode === 'forward' ? 'Inoltra email' : composer.mode === 'replyAll' ? 'Rispondi a tutti' : 'Rispondi'}
                            </h3>
                            <button onClick={() => !composerSending && setComposer(null)} className="text-gray-400 hover:text-gray-700">
                                <X size={18} />
                            </button>
                        </div>

                        {/* FORM */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Da</label>
                                <input
                                    value={composer.from_email || ''}
                                    readOnly
                                    className="w-full px-3 py-2 rounded border border-gray-200 bg-gray-50 text-sm font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">A *</label>
                                <EmailRecipientInput
                                    value={composer.to || ''}
                                    onChange={(v) => setComposer({ ...composer, to: v })}
                                    placeholder="Cerca nome o scrivi email + Invio…"
                                    className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Cc</label>
                                <EmailRecipientInput
                                    value={composer.cc || ''}
                                    onChange={(v) => setComposer({ ...composer, cc: v })}
                                    placeholder="Cerca nome o scrivi email + Invio…"
                                    className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Bcc</label>
                                <EmailRecipientInput
                                    value={composer.bcc || ''}
                                    onChange={(v) => setComposer({ ...composer, bcc: v })}
                                    placeholder="Cerca nome o scrivi email + Invio…"
                                    className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Oggetto *</label>
                                <input
                                    value={composer.subject || ''}
                                    onChange={(e) => setComposer({ ...composer, subject: e.target.value })}
                                    className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <EmailAttachmentsInput
                                    value={attachedFiles}
                                    onChange={setAttachedFiles}
                                    relationId={composer.in_reply_to_id ? null : undefined}
                                    userToken={user?.token}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Corpo</label>
                                <textarea
                                    value={composer.body || ''}
                                    onChange={(e) => setComposer({ ...composer, body: e.target.value })}
                                    rows={12}
                                    className="w-full px-3 py-2 rounded border border-gray-200 text-sm resize-y font-mono"
                                />
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => !composerSending && setComposer(null)}
                                disabled={composerSending}
                                className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white disabled:opacity-50"
                            >
                                Annulla
                            </button>
                                {composer.mode !== 'new' && composer.in_reply_to_id && (
                                    <button
                                        type="button"
                                        onClick={suggestAIReply}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50"
                                        title="Suggerisci risposta con AI (Susanna)"
                                    >
                                        ✨ Suggerisci
                                    </button>
                                )}
                            <button
                                onClick={sendComposer}
                                disabled={composerSending}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {composerSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                {composerSending ? 'Invio…' : 'Invia'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DETTAGLIO EMAIL (21/09/2026) */}
            {emailDetail && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setEmailDetail(null); setEmailAttachments([]); }}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* HEADER */}
                        <div className="border-b border-gray-100 px-5 py-3 flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-[#1a2744] truncate">
                                    {emailDetail.subject || (emailDetailLoading ? 'Caricamento...' : 'Email')}
                                </h3>
                                {!emailDetailLoading && emailDetail.sender_email && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                        Da: <span className="font-medium">{emailDetail.sender_email}</span>
                                    </p>
                                )}
                                {!emailDetailLoading && emailDetail.create_date && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(emailDetail.create_date).toLocaleString('it-IT')}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setEmailDetail(null)} className="text-gray-400 hover:text-gray-700 ml-3">
                                <X size={18} />
                            </button>
                        </div>

                        {/* BODY */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {emailDetailLoading ? (
                                <div className="flex items-center gap-2 text-gray-500 text-sm">
                                    <Loader2 size={16} className="animate-spin" /> Caricamento email...
                                </div>
                            ) : emailDetail.error ? (
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                                    {emailDetail.error}
                                </div>
                            ) : (
                                <>
                                    {emailDetail.relation_name && (
                                        <div className="mb-3 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                                            <FolderOpen size={11} /> {emailDetail.relation_name}
                                        </div>
                                    )}
                                    <div
                                        className="prose prose-sm max-w-none text-sm text-gray-800"
                                        dangerouslySetInnerHTML={{ __html: emailDetail.body || '<p class="text-gray-400 italic">(nessun corpo)</p>' }}
                                    />
                                </>
                            )}
                        </div>

                        {/* FOOTER: azioni reply/forward */}
                        {emailAttachments.length > 0 && (
                            <div className="px-5 pb-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Allegati ({emailAttachments.length})</p>
                                <div className="space-y-1">
                                    {emailAttachments.map((a) => (
                                        <a key={a.id} href={`/api/admin/attachments/${a.id}/download`} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center justify-between text-sm bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded px-3 py-2">
                                            <span className="truncate">📎 {a.name}</span>
                                            <span className="text-xs text-gray-400 ml-2">{a.size ? Math.round(a.size / 1024) + ' KB' : ''}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap justify-end gap-2 bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => openComposer(emailDetail.id, 'reply')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                            >
                                <Reply size={13} /> Rispondi
                            </button>
                            <button
                                onClick={() => openComposer(emailDetail.id, 'replyAll')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                            >
                                <ReplyAll size={13} /> Rispondi a tutti
                            </button>
                            <button
                                onClick={() => openComposer(emailDetail.id, 'forward')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-100"
                            >
                                <Forward size={13} /> Inoltra
                            </button>
                            <button
                                onClick={() => setEmailDetail(null)}
                                className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </div>
        </div>
    );
}
