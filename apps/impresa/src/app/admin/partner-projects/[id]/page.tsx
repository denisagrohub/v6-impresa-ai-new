// ═══════════════════════════════════════════════════════════════════
// Partner Project Detail — orchestratore del progetto di mediazione.
//
// Refactor C (29/09/2026): il monolite originale (2043 righe) è stato
// spezzato in componenti in components/admin/partner-projects/detail/:
//
//   - PartnerProjectHeader        top bar (azioni, alias, charter)
//   - PartnerProjectStatusBar     KPI rapidi + toggle workbench/lavagna
//   - PartnerProjectTabs          tab Copertina / Operativa (C3)
//   - OperativaMain               colonna sinistra (workbench + lavagna)
//   - OperativaAside              colonna destra (intelligence, parti, doc)
//   - ModalsEmail                 composer + sorgente + libreria
//   - ModalsCall                  create call + brief + presentazione
//   - ModalsSystem                settings, acq, persona, live call, coda
//
// Questo file orchestra: fetch dei dati, stato condiviso tra componenti,
// routing dei tab, mount condizionale. Nessuna logica di presentazione.
//
// Dipendenze: dati da /api/admin/partner-projects/[id], stato in
// useState, azioni passate come props raggruppate.
// ═══════════════════════════════════════════════════════════════════

"use client";
/* ═══════════════════════════════════════════════════════════════════════════
   PAGINA: Dettaglio Progetto Partner — Workbench / Lavagna Strategica
   SCOPO: Hub operativo per gestire un progetto con più "parti collegate":
          - Flusso email (in/out) con analisi automatica delle richieste aperte
          - Invio email con allegati (da PC o da Libreria) e flag di richiesta
          - Call video via Odoo Discuss (creazione canale + popup)
          - Documenti/atti collegati (upload + download)
          - Brief/Debrief e Note di call inviabili come email
          - Modalità Presentazione (schermo pieno per call/meeting)
          - Intelligence: router verso motori AI (Susanna interna, ChatGPT,
            Gemini, OnAlpha esterni) con copia del contesto negli appunti
   ARCHITETTURA: tutte le operazioni passano da API route Next.js che parlano
          con Odoo via XML-RPC/JSON-RPC. Il client NON tocca mai Odoo diretto.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation"; // routing App Router
import Link from "next/link";
// Icone SVG (lucide): mantenerle piccole per performance
import {
    Loader2, ArrowLeft, Send, ChevronDown, ChevronUp, UserPlus, Briefcase, ExternalLink,
    Sparkles, Download, Settings, LayoutGrid, Table, UploadCloud,
    Activity, FileText, Zap, Video, Monitor, ChevronDown as ChevD, Layers, Plus, ChevronRight, Phone, } from "lucide-react";
// DOMPurify: i body email arrivano come HTML da Odoo → vanno SANITIZZATI (anti-XSS)
import DOMPurify from "dompurify";
// Componenti laterali: pannelli AI/note incastonati nelle card delle parti
import HeinrichPanel from "@/components/admin/HeinrichPanel";
import NotesBoard from "@/components/admin/NotesBoard";
import { WorkAreaPanel } from "@/components/admin/WorkAreaPanel";
import { RichPartModal } from "@/components/admin/RichPartModal";
import { ScoutingModal, type ScoutingData } from "@/components/admin/ScoutingModal";
import { CharterEditor, type CharterData } from "@/components/CharterEditor";
import LiveCallDrawer from "@/components/admin/LiveCallDrawer";
import Dropdown from "@/components/ui/Dropdown";
import KpiDashboard from "@/components/admin/kpi/KpiDashboard";
import CopertinaPage, { type OperativaContext } from "@/components/admin/CopertinaPage";
import AcquisitionKanban from "@/components/admin/AcquisitionKanban";
import RelationScoutingPanel, { type RelationScoutingData } from "@/components/admin/RelationScoutingPanel";
import CallEndPanel from "@/components/admin/CallEndPanel";
import PersonCard from "@/components/admin/PersonCard";
import { LifecycleBadge } from "@/components/admin/LifecycleBadge";
import { DealCard, type DealCollegato } from "@/components/deals/DealCard";
import { ChildProjectsList } from "@/components/projects/ChildProjectsList";
import { DealsKanban, type KanbanDeal } from "@/components/deal/DealsKanban";
import { KpiDealRow, type KpiDeal } from "@/components/deal/KpiDealRow";
import { DealCommandCenter, type DealCommandCenterData } from "@/components/deal/DealCommandCenter";
import { Breadcrumb, type BreadcrumbItem } from "@/components/admin/Breadcrumb";
import { getAuthToken } from "@/components/deal/auth";
import { PartnerProjectHeader, type PartnerProjectHeaderHandlers } from "@/components/admin/partner-projects/detail/PartnerProjectHeader";
import { ProjectScoutingCard } from "@/components/admin/ProjectScoutingCard";
import { DealTimeline } from "@/components/deal/DealTimeline";
import { PartnerProjectStatusBar, type ViewMode } from "@/components/admin/partner-projects/detail/PartnerProjectStatusBar";
import { PartnerProjectTabs, type PartnerProjectTab } from "@/components/admin/partner-projects/detail/PartnerProjectTabs";
import { OperativaMain } from "@/components/admin/partner-projects/detail/OperativaMain";
import { OperativaAside } from "@/components/admin/partner-projects/detail/OperativaAside";
import { ModalsEmail } from "@/components/admin/partner-projects/detail/ModalsEmail";
import { ModalsCall } from "@/components/admin/partner-projects/detail/ModalsCall";
import { ModalsSystem } from "@/components/admin/partner-projects/detail/ModalsSystem";
import { analyzeSentEmailContent } from "@/lib/partner-projects/email-analysis";

/* ───────────────────────── TYPE DEFINITIONS ───────────────────────── */

// Una "parte" collegata al progetto (utile per raggruppare contatti)
interface ChildProject {
    id: number;
    name: string;
    state: string;
    partnerName: string | null;
    deals: DealCollegato[];
}

interface Partner {
    id: number;
    name: string;
    ruolo: string | null;
    partnerId: number | null;   // res.partner in Odoo, se mappato
    partnerName: string | null;
    lifecycleStage?: string | null;
}

// Log email mostrato nell'elenco (senza body: caricato on-demand)
interface EmailLog {
    id: number;
    subject: string;
    senderEmail: string;
    recipientEmails: string;
    ccEmails: string;
    matchStatus: string;
    direction: 'ricevuta' | 'inviata';
    date: string;
    relationId?: number | null;
    recipientRelationId?: number | null;
    // 02/10/2026 (C2-rd-prog): letto per-utente via read.state
    is_read?: boolean;
    read_at?: string | null;
}

// Allegato nel composer: da PC (fileRaw → base64) o da Libreria (id già su Odoo)
interface AttachedFile {
    id?: string | number;   // presente solo per source=library
    name: string;
    url?: string;
    fileRaw?: File;         // presente solo per source=local
    source: 'local' | 'library';
}

// Motori intelligence selezionabili dall'utente
type IntelligenceEngine = 'susanna' | 'chatgpt' | 'gemini' | 'onalpha';

export default function PartnerProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string; // id progetto dall'URL /admin/partner-projects/[id]

    /* ── STATO PRINCIPALE ── */
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'workbench' | 'lavagna'>('workbench');
    const [activeEngine, setActiveEngine] = useState<IntelligenceEngine>('susanna');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ intelligence: true, sottoprogetti: true, parti: true, documenti: true, attivita: true });
    const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
    const [lifecycleFilter, setLifecycleFilter] = useState<'all' | 'active' | 'degraded'>('all');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // 19/09/2026: target di rendimento (vive su x_v6_kpi_targets in Odoo)
    const [kpiTargetsEdit, setKpiTargetsEdit] = useState<{ targetAttivi: number; partnerAnno: number; callMese: number; emailMese: number }>({ targetAttivi: 20, partnerAnno: 5, callMese: 10, emailMese: 30 });
    const [kpiTargetsBusy, setKpiTargetsBusy] = useState(false);
    const [kpiTargetsMsg, setKpiTargetsMsg] = useState<string | null>(null);
    const [isRichPartOpen, setIsRichPartOpen] = useState(false);
    const [partnerScouting, setPartnerScouting] = useState<Record<number, ScoutingData | null>>({});

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [project, setProject] = useState<{
        id: number; name: string; emailAlias: string | null; parent_id?: number | null;
        funzione_progetto?: string | null;
        contatto_principale_id?: number | null;
        state?: string;
    charter?: CharterData | null;
    relationScouting?: RelationScoutingData | null } | null>(null);

    // 19/09/2026: carica KPI targets quando si apre Settings
    // 01/10/2026 (B): carico eventi quando si apre modal email
    useEffect(() => {
        if (!isEmailModalOpen || !project?.id) return;
        const token = (() => {
            try {
                const raw = localStorage.getItem('pi_session');
                const s = raw ? JSON.parse(raw) : null;
                return s?.token || '';
            } catch { return ''; }
        })();
        fetch(`/api/admin/relations/${project.id}/events`, {
            headers: { Authorization: `JWT ${token}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success && Array.isArray(d.events)) {
                    // Solo eventi top-level (no figli di altri)
                    const top = d.events.filter((e: any) => e.eventType !== 'email_rilevante');
                    setAvailableEvents(top);
                }
            })
            .catch(() => {});
    }, [isEmailModalOpen, project?.id]);

    useEffect(() => {
        if (!isSettingsOpen || !project?.id) return;
        fetch(`/api/admin/partner-projects/${project.id}/kpi-targets`)
            .then(r => r.json())
            .then(d => { if (d.success && d.targets) setKpiTargetsEdit({
                targetAttivi: d.targets.targetAttivi ?? 20,
                partnerAnno: d.targets.partnerAnno ?? 5,
                callMese: d.targets.callMese ?? 10,
                emailMese: d.targets.emailMese ?? 30,
            }); })
            .catch(() => {});
    }, [isSettingsOpen, project?.id]);
    // 18/09/2026 (Denis): se il nodo ha figli target -> dashboard kanban.
    const [isKanbanBoard, setIsKanbanBoard] = useState(false);
    const [partners, setPartners] = useState<Partner[]>([]);
    // 17/09/2026 (Denis): figli non-parte = rami operativi con pipeline propria
    // 19/09/2026: target = figli con funzione_progetto='target' (kanban)
    const [targets, setTargets] = useState<{ id: number; name: string; partnerName: string | null; partnerEmail?: string | null; contattoName: string | null; contattoEmail?: string | null; stageId: number | null; state: string }[]>([]);
    const [emails, setEmails] = useState<EmailLog[]>([]);
    // 02/10/2026 (C2-rd-prog): conteggio email non lette per badge status bar
    const [unreadCount, setUnreadCount] = useState<number>(0);
    // 28/09/2026: deal collegati (dal modello erpv6.deal)
    const [deals, setDeals] = useState<DealCollegato[]>([]);
    const [dealsFlat, setDealsFlat] = useState<KanbanDeal[]>([]);
    const [kpiDeal, setKpiDeal] = useState<KpiDeal | null>(null);
    const [dealCollegato, setDealCollegato] = useState<DealCommandCenterData | null>(null);
    const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbItem[]>([]);
    // Progetti figli con child_kind='progetto' (deal operativi)
    const [childProjects, setChildProjects] = useState<ChildProject[]>([]);
    const [showAcqModal, setShowAcqModal] = useState(false);
    const [acqName, setAcqName] = useState('Acquisizione Aziende');
    const [acqAlias, setAcqAlias] = useState('');
    const [acqError, setAcqError] = useState<string | null>(null);
    const [acqBusy, setAcqBusy] = useState(false);
    const [acqKind, setAcqKind] = useState('sotto_progetto');
    const [acqPipeline, setAcqPipeline] = useState('acquisition');
    // 18/09/2026 (Denis): Live Call Mode
    const [liveCallOpen, setLiveCallOpen] = useState(false);
    const [liveCallPartnerId, setLiveCallPartnerId] = useState<number | null>(null);
    const [liveCallPartnerName, setLiveCallPartnerName] = useState('');

    // 14/09/2026: soglia "visto" — le email dopo questa sono NUOVE (ambra).
    // Nota: al load segnamo seen=adesso, quindi il highlight vale per il
    // PROSSIMO caricamento (comportamento voluto: vedi cosa e' arrivato mentre non guardavi).
    const seenAt: string | null = (project as any)?.x_v6_emails_seen_at || null;

    /* ── STATO EMAIL (lista) ──
       openEmailId: email espansa (accordion, una sola alla volta → focus)
       emailBodies: cache {id → html} per non rifare la fetch ad ogni toggle */
    const [openEmailId, setOpenEmailId] = useState<number | null>(null);
    const [emailBodies, setEmailBodies] = useState<Record<number, string | null>>({});
    const [loadingBodyId, setLoadingBodyId] = useState<number | null>(null);

    /* ── STATO COMPOSER EMAIL ── */
    const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);
    const [extraEmails, setExtraEmails] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
    // Flag semantici: dichiarano l'"azione richiesta" → generano badge di tracking
    const [requiresSignature, setRequiresSignature] = useState(false);
    const [requiresDocument, setRequiresDocument] = useState(false);
    const [requiresAction, setRequiresAction] = useState(false);
    // 01/10/2026 (B): email collegata a un evento (tavolo, call...)
    const [linkedEventId, setLinkedEventId] = useState<number | null>(null);
    const [availableEvents, setAvailableEvents] = useState<{ id: number; title: string; event_date: string | null; event_type: string }[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

    /* ── STATO AGGIUNTA PARTE ──
       Autocomplete su res.partner: se l'utente sceglie un esistente si riusa
       il partnerId, altrimenti si crea una parte "libera" solo col nome */
    const [showAddPart, setShowAddPart] = useState(false);
    const [partName, setPartName] = useState("");
    const [partEmail, setPartEmail] = useState("");
    const [savingPart, setSavingPart] = useState(false);
    const [addPartError, setAddPartError] = useState<string | null>(null);
    const [partnerResults, setPartnerResults] = useState<{ id: number; name: string; email: string | null; phone: string | null }[]>([]);
    const [selectedExistingPartnerId, setSelectedExistingPartnerId] = useState<number | null>(null);

    /* ── STATO DOCUMENTI ── */
    const [documents, setDocuments] = useState<{ id: number; name: string; file_size: number; create_date: string }[]>([]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    /* ── STATO ALLEGATI DA LIBRERIA ── */
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);   // sorgente allegato
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false); // elenco libreria
    const [libraryDocs, setLibraryDocs] = useState<{ id: string | number; name: string; url?: string }[]>([]);
    const [loadingLibrary, setLoadingLibrary] = useState(false);

    /* ── STATO CALL ODOO DISCUSS ── */
    const [isCreateCallModalOpen, setIsCreateCallModalOpen] = useState(false);
    const [callSubject, setCallSubject] = useState('');
    const [callSelectedPartners, setCallSelectedPartners] = useState<number[]>([]);
    const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null); // canale riapribile
    const [isGeneratingCall, setIsGeneratingCall] = useState(false);

    /* ── STATO MODALITÀ PRESENTAZIONE ──
       Overlay full-screen: dashboard "muto" per proiezione + pannello note call */
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [activeOverlayPanel, setActiveOverlayPanel] = useState<'notes' | null>(null);
    const [callNoteText, setCallNoteText] = useState('');

    /* ── STATO BRIEF / DEBRIEF ── */
    const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
    // 18/09/2026 (Denis): Scouting Relazione (profilo target del progetto)
    const [isRelationScoutingOpen, setIsRelationScoutingOpen] = useState(false);
    // 19/09/2026 (Denis): Copertina (dashboard cliccabile) vs Operativa (workbench)
    const [viewTab, setViewTab] = useState<'copertina' | 'operativa'>('copertina');

    // 19/09/2026: reset modal aperti quando si cambia tab (evita Charter che resta aperto)
    useEffect(() => {
        setShowCharterInCopertina(false);
    }, [viewTab]);
    const [operativeContext, setOperativeContext] = useState<OperativaContext | null>(null);

    // 19/09/2026: filtro email per contesto.
    // Logica: match su (a) relation_id del nodo contesto, (b) recipient_relation_id,
    // (c) email del partner collegato al nodo (sender o recipient).
    const filteredEmails = (() => {
        if (!operativeContext || !('id' in operativeContext) || !operativeContext.id) return emails;
        const ctxId = operativeContext.id;
        // 19/09/2026: il contesto puo' essere persona O target.
        // Se target, cerca in targets; se persona, in partners.
        const ctxPerson: any = operativeContext.type === 'target'
            ? targets.find((t: any) => t.id === ctxId)
            : partners.find((p: any) => p.id === ctxId);
        // Raccogli TUTTE le email riconducibili al contesto.
        // Concetto chiave: l'email va sotto il DESTINATARIO (o CC), non sotto il mittente.
        const emailsCtx: string[] = [];
        if (ctxPerson?.partnerEmail) emailsCtx.push(String(ctxPerson.partnerEmail).toLowerCase());
        if (ctxPerson?.contattoEmail) emailsCtx.push(String(ctxPerson.contattoEmail).toLowerCase());
        // Anche email dirette del nodo stesso (se persona)
        if (ctxPerson?.partnerEmail) emailsCtx.push(String(ctxPerson.partnerEmail).toLowerCase());
        const namesCtx: string[] = [];
        if (operativeContext.label) namesCtx.push(operativeContext.label.toLowerCase());
        if (ctxPerson?.partnerName) namesCtx.push(String(ctxPerson.partnerName).toLowerCase());
        if (ctxPerson?.contattoName) namesCtx.push(String(ctxPerson.contattoName).toLowerCase());
        if (ctxPerson?.name) namesCtx.push(String(ctxPerson.name).toLowerCase());

        return emails.filter((e: any) => {
            const relId = e.relationId ?? e.relation_id;
            const recvRelId = e.recipientRelationId ?? e.recipient_relation_id;
            // match diretto sul nodo
            if (relId === ctxId || recvRelId === ctxId) return true;
            // match per email: cercare nelle email del destinatario + CC (NON nel sender, altrimenti
            // ogni email che parte da tony@ finirebbe sotto tony in ogni contesto)
            const recipients = (e.recipientEmails || '').toLowerCase();
            const cc = (e.ccEmails || '').toLowerCase();
            const sender = (e.senderEmail || '').toLowerCase();
            for (const needle of emailsCtx) {
                if (!needle) continue;
                if (recipients.includes(needle)) return true;
                if (cc.includes(needle)) return true;
            }
            // fallback: cerca il nome nel subject (per email "all'attenzione di Marco Nardi")
            const subject = (e.subject || '').toLowerCase();
            const body = ''; // il body non è nel log, solo on demand
            const haystack = subject + ' ' + sender + ' ' + recipients + ' ' + cc;
            for (const n of namesCtx) {
                if (n.length >= 5 && haystack.includes(n)) return true;
            }
            return false;
        });
    })()
    // 19/09/2026: lista persone/target per il selettore contesto
    const [contextOptions, setContextOptions] = useState<{ persone: any[]; targets: any[] }>({ persone: [], targets: [] });
    // 18/09/2026 (Denis): pannello post-call (debrief + lead + email)
    const [lastCallEnd, setLastCallEnd] = useState<{ callId: number; durationSeconds: number; partnerId: number | null } | null>(null);
    // 19/09/2026: scheda persona (modal dettagli) — dati SEMPRE su Odoo
    const [detailPerson, setDetailPerson] = useState<any | null>(null);
    // 19/09/2026: modal Charter aperto dalla Copertina
    const [showCharterInCopertina, setShowCharterInCopertina] = useState(false);
    const [briefType, setBriefType] = useState<'brief' | 'debrief'>('brief');
    const [briefData, setBriefData] = useState({ objective: '', targetAudience: '', keyDeliverables: '', risksOrNotes: '' });

    // URL dei motori esterni. Susanna = interna (nessun URL), OnAlpha = piattaforma proprietaria.
    const externalAiUrls: Record<IntelligenceEngine, string> = {
        susanna: '',
        chatgpt: 'https://chatgpt.com/',
        gemini: 'https://gemini.google.com/',
        onalpha: 'https://onalpha.ai/', // ← TODO: conferma URL esatto della tua istanza OnAlpha
    };

    /* ═════════════════════ LOADING DATI ═════════════════════ */

    // Carica SOLO i documenti (separato: si ricarica dopo upload senza toccare il resto)
    const loadDocuments = async () => {
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}/documents`);
            const data = await res.json();
            if (data.success) setDocuments(data.documents || []);
        } catch { /* silenzioso: i documenti non sono critici al primo render */ }
    };

    // Caricamento principale: progetto + parti + email in una sola chiamata
    const load = async () => {
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setProject(data.project);
            // 02/10/2026 (C2-rd-prog): rimossa la POST /emails-seen al load.
            // Il "letto" ora è per-utente (erpv6.email.read.state), marcato
            // quando si apre la singola email. Vedi toggleEmail.
            setPartners(data.partners || []);
            setTargets(data.targets || []);
            setDeals(data.deals || []);
            setDealsFlat(data.dealsFlat || []);
            setKpiDeal(data.kpiDeal || null);
            setDealCollegato(data.dealCollegato || null);
            setBreadcrumbItems(data.breadcrumb || []);
            setChildProjects(data.childProjects || []);
            setContextOptions({
                persone: (data.partners || []).filter((p: any) => p.funzione_progetto !== 'target'),
                targets: data.targets || [],
            });

            // 28/09/2026: detection kanban target SOLO se il nodo è pipeline pura
            // (no padre con deal, no figlio deal). Priorità a DASH-4/DASH-3.
            // 29/09/2026 (C3): isKanbanBoard = metadato "questo progetto
            // ha una pipeline target". Non e' piu' un gate: la scelta
            // Copertina vs Operativa e' gestita dal TabBar (viewTab).
            if (data.project?.hasPipelineBoard === true) {
                setIsKanbanBoard(true);
            }
            setEmails((data.emails || []).map((e: any) => ({
                ...e,
                relationId: Array.isArray(e.relation_id) ? e.relation_id[0] : (e.relationId ?? null),
                recipientRelationId: Array.isArray(e.recipient_relation_id) ? e.recipient_relation_id[0] : (e.recipientRelationId ?? null),
            })));
            // 02/10/2026 (C2-rd-prog): conteggio non-lette per il badge
            setUnreadCount(data.unreadCount || 0);
            loadDocuments(); // fire-and-forget
        } catch (error: any) {
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    // Gate di sessione: senza pi_session → login. Poi carico i dati.
    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        if (id) load();
    }, [id, router]);

    // Libreria documenti: caricata lazy solo quando si apre il modal (performance)
    useEffect(() => {
        if (isLibraryModalOpen && project?.id) {
            setLoadingLibrary(true);
            fetch(`/api/projects/${project.id}/documents`)
                .then((res) => res.json())
                .then((data) => setLibraryDocs(Array.isArray(data) ? data : data.documents || []))
                .catch((err) => console.error("Errore nel caricamento della Libreria:", err))
                .finally(() => setLoadingLibrary(false));
        }
    }, [isLibraryModalOpen, project?.id]);

    /* ═════════════════════ ANALISI EMAIL USCITE ═════════════════════
       Pattern-matching heuristico sull'oggetto+corpo delle email inviate:
       rileva se abbiamo CHIESTO qualcosa (firma / documenti / riscontro)
       per mostrare badge di "attesa". Costa zero (nessuna AI necessaria)
       ed è deterministico: base perfetta per il tracking lean dei pending. */
    /* ═════════════════════ EMAIL: LETTURA ═════════════════════ */

    // Accordion: apre/chiude un'email e carica il body solo al primo open (lazy + cache)
    const toggleEmail = async (emailId: number) => {
        if (openEmailId === emailId) {
            setOpenEmailId(null);
            return;
        }
        setOpenEmailId(emailId);
        if (emailBodies[emailId] === undefined) {
            setLoadingBodyId(emailId);
            try {
                const res = await fetch('/api/admin/partner-projects/' + id + '/emails/' + emailId);

                const data = await res.json();
                setEmailBodies((prev) => ({ ...prev, [emailId]: data.success ? data.body : null }));
            } catch {
                setEmailBodies((prev) => ({ ...prev, [emailId]: null }));
            } finally {
                setLoadingBodyId(null);
            }
        }
    };

    // Toggle checkbox destinatario (multi-select parti)
    const togglePartner = (partnerId: number) => {
        setSelectedPartnerIds((prev) =>
            prev.includes(partnerId) ? prev.filter((p) => p !== partnerId) : [...prev, partnerId]
        );
    };

    /* ═════════════════════ EMAIL: INVIO ═════════════════════
       Ritorna boolean così i modal chiamanti sanno se chiudersi o meno.
       Allegati:
       - local  → FileReader → base64 → ricreati su Odoo come ir.attachment
       - library → solo l'id: l'API aggancia l'attachment esistente (no upload) */
    const handleSend = async (e: React.FormEvent): Promise<boolean> => {
        e.preventDefault();
        setSending(true);
        setSendResult(null);
        try {
            const localFiles = await Promise.all(
                attachedFiles
                    .filter((f) => f.source === 'local' && f.fileRaw)
                    .map(async (f) => ({
                        fileName: f.name,
                        mimetype: f.fileRaw!.type,
                        fileBase64: await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
                            reader.onerror = reject;
                            reader.readAsDataURL(f.fileRaw!);
                        }),
                    }))
            );

            const res = await fetch(`/api/admin/partner-projects/${id}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerIds: selectedPartnerIds,
                    extraEmails,
                    subject,
                    // Il testo viene inviato come HTML: \n → <br/> per rispettare gli a-capo
                    message: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
                    linkedEventId: linkedEventId || undefined,
                    requiresSignature,
                    requiresDocument,
                    requiresAction,
                    attachments: [
                        ...localFiles,
                        ...attachedFiles
                            .filter((f) => f.source === 'library' && f.id)
                            .map((f) => ({ attachmentId: f.id })),
                    ],
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setSendResult({ ok: false, text: data.error || 'Invio fallito' });
                return false;
            }
            // Reset completo del composer dopo successo (avoid stale state)
            setSendResult({ ok: true, text: 'Email inviata.' });
            setSubject("");
            setMessage("");
            setLinkedEventId(null);
            setExtraEmails("");
            setSelectedPartnerIds([]);
            setAttachedFiles([]);
            setRequiresSignature(false);
            setRequiresDocument(false);
            setRequiresAction(false);
            load(); // ricarico per vedere la nuova email nel flusso
            return true;
        } catch (error: any) {
            setSendResult({ ok: false, text: error.message || 'Errore di rete' });
            return false;
        } finally {
            setSending(false);
        }
    };

    /* ═════════════════════ DOCUMENTI ═════════════════════ */

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploading(true);
        setUploadError(null);
        try {
            // File → base64 (trasporto JSON-friendly; su server diventa ir.attachment)
            const base64: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
                reader.onerror = reject;
                reader.readAsDataURL(uploadFile);
            });
            const res = await fetch(`/api/admin/partner-projects/${id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileBase64: base64, fileName: uploadFile.name, mimetype: uploadFile.type }),
            });
            const data = await res.json();
            if (!data.success) {
                setUploadError(data.error || 'Caricamento fallito');
                return;
            }
            setUploadFile(null);
            await loadDocuments();
        } catch (err: any) {
            setUploadError(err.message || 'Errore di rete');
        } finally {
            setUploading(false);
        }
    };

    /* ═════════════════════ AGGIUNTA PARTE (autocomplete res.partner) ═════════════════════
       Debounce 300ms: evita di martellare l'API ad ogni tasto.
       La search si disattiva se ho già selezionato un partner esistente. */
    useEffect(() => {
        if (selectedExistingPartnerId || partName.trim().length < 2) {
            setPartnerResults([]);
            return;
        }
        const t = setTimeout(() => {
            fetch(`/api/admin/partners/search?q=${encodeURIComponent(partName.trim())}`)
                .then((res) => res.json())
                .then((data) => { if (data.success) setPartnerResults(data.partners || []); })
                .catch(() => { });
        }, 300);
        return () => clearTimeout(t);
    }, [partName, selectedExistingPartnerId]);

    // Selezione da autocomplete: riusa il res.partner esistente (no duplicati in Odoo)
    const handleSelectExistingPartner = (p: { id: number; name: string; email: string | null; phone: string | null }) => {
        setSelectedExistingPartnerId(p.id);
        setPartName(p.name);
        setPartEmail(p.email || "");
        setPartnerResults([]);
    };

    const handleAddPart = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPart(true);
        setAddPartError(null);
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}/parts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: partName, email: partEmail,
                    // Se undefined l'API creerà un nuovo res.partner, altrimenti linka
                    partnerId: selectedExistingPartnerId || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setAddPartError(data.error || 'Creazione fallita');
                return;
            }
            setPartName(""); setPartEmail("");
            setSelectedExistingPartnerId(null);
            setShowAddPart(false);
            load();
        } catch (err: any) {
            setAddPartError(err.message || 'Errore di rete');
        } finally {
            setSavingPart(false);
        }
    };

    /* ═════════════════════ BRIDGE NOTE → EMAIL ═════════════════════
       Usato da NotesBoard, Brief/Debrief e Note di call.
       Destinatari = tutte le parti con partnerId mappato. */
    const handleNoteSendEmail = async (note: { title: string; body: string; note_type: string }) => {
        const recipientIds = partners.map((p) => p.partnerId).filter((x): x is number => x != null);
        if (!recipientIds.length) {
            return { ok: false, text: 'Nessuna parte collegata con un contatto valido.' };
        }
        const res = await fetch(`/api/admin/partner-projects/${id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                partnerIds: recipientIds,
                subject: note.title || (note.note_type === 'brief' ? 'Brief progetto' : note.note_type === 'debrief' ? 'Debrief progetto' : 'Aggiornamento progetto'),
                message: `<p>${note.body.replace(/\n/g, '<br/>')}</p>`,
            }),
        });
        const data = await res.json();
        return data.success ? { ok: true, text: `Inviata a ${recipientIds.length} parti.` } : { ok: false, text: data.error || 'Invio fallito' };
    };

{/* ═════════════════════ INTELLIGENCE / CALL / PRESENTAZIONE ═════════════════════ */}

    // Copia il contesto minimo (progetto + alias) negli appunti: incollabile nei motori AI
    const copyContextToClipboard = () => {
        if (project) {
            navigator.clipboard.writeText(`PROGETTO: ${project.name} | ALIAS: ${project.emailAlias || 'N/A'}`);
        }
    };

    // Popup dedicato alla call: finestra separata stile "sala riunioni"
    const openCallPopup = (url: string) => {
        window.open(url, 'OdooDiscussCall', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    };

    // Crea canale mail.channel su Odoo (via API) e apre il popup
    const handleCreateAndStartCall = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGeneratingCall(true);
        try {
            const response = await fetch('/api/odoo/discuss/create-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project?.id,
                    name: callSubject || `Call Progetto - ${project?.name || ''}`,
                    partnerIds: callSelectedPartners,
                }),
            });
            const data = await response.json();
            if (data.ok && data.callUrl) {
                setActiveCallUrl(data.callUrl);      // salvato: call riapribile dopo
                setIsCreateCallModalOpen(false);
                openCallPopup(data.callUrl);
            } else {
                alert('Errore durante la creazione del canale Odoo Discuss');
            }
        } catch (err) {
            console.error('Errore creazione call:', err);
        } finally {
            setIsGeneratingCall(false);
        }
    };

    /* ═════════════════════ RENDER ═════════════════════ */

    // 1. Spinner a schermo pieno durante il primo caricamento
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={36} className="animate-spin text-[#1a7fa8]" />
            </div>
        );
    }

    // 2. Errore bloccante solo se non ho nemmeno il progetto (fail-soft sul resto)
    if (loadError && !project) {
        return (
            <div className="min-h-screen bg-[#f8fafc] p-8">
                <Link href="/admin/partner-projects" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={14} /> Torna ai progetti
                </Link>
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700">{loadError}</div>
            </div>
        );
    }

    // 3. Layout: header compatto + griglia [contenuto 1fr | sidebar 380px]
    // Vista KANBAN: sotto-progetto con pipeline (es. Acquisizione Aziende)
    return (
        <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-[#2b3440] font-sans text-[13px] overflow-hidden">

            {/* ───── HEADER: titolo, alias email, contatori live, switch vista ───── */}
            <header className="bg-white border-b border-[#e2e8f0] px-5 py-2.5 shrink-0 z-20">
                <PartnerProjectHeader
                    projectId={project?.id ?? 0}
                    projectName={project?.name ?? ''}
                    projectParentId={project?.parent_id ?? null}
                    projectEmailAlias={project?.emailAlias ?? null}
                    projectCharter={project?.charter ?? null}
                    projectCatalogVisible={!!(project as any)?.catalogVisible}
                    handlers={{
                        onOpenPlaybook: () => window.open(`/consultant/partner-projects/${project?.id}/playbook`, '_blank'),
                        onOpenPitchPublic: () => {
                            if (!project?.emailAlias) return;
                            const slug = (project.emailAlias as string).split('@')[0];
                            window.open(`/p/${slug}`, '_blank');
                        },
                        onSendPitch: () => {
                            if (!project?.emailAlias) return;
                            const slug = (project.emailAlias as string).split('@')[0];
                            const url = `${window.location.origin}/p/${slug}`;
                            setSubject(`Scopri il progetto ${project.name} — V6 Impresa`);
                            setMessage(`Ciao,\n\nTi segnalo il progetto "${project.name}" su cui stiamo lavorando.\n\nSe ti rivedi o conosci aziende del settore interessate, puoi candidarti qui:\n${url}\n\nA presto,\nV6 Impresa`);
                            setIsEmailModalOpen(true);
                        },
                        onNewVideoCall: () => setIsCreateCallModalOpen(true),
                        onLiveCall: () => setLiveCallOpen(true),
                        onBriefPrecall: () => { setBriefType('brief'); setIsBriefModalOpen(true); },
                        onScoutingCompany: () => setShowAddPart(true),
                        onScoutingRelation: () => setIsRelationScoutingOpen(true),
                        onPresentation: () => setIsPresentationMode(true),
                        onNewSubproject: () => setShowAcqModal(true),
                        onOpenSettings: () => setIsSettingsOpen(true),
                        onCharterChanged: (c) => setProject((p: any) => p ? { ...p, charter: c } : p),
                        onToggleCatalog: async () => {
                            try {
                                const token = getAuthToken();
                                const r = await fetch(`/api/admin/partner-projects/${project?.id}/catalog-toggle`, {
                                    method: 'POST',
                                    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({}),
                                });
                                const d = await r.json();
                                if (d.success) {
                                    // Ricarica il progetto per aggiornare il flag
                                    load();
                                } else {
                                    alert(d.error || 'Errore toggle catalogo');
                                }
                            } catch (e: any) { alert(e.message); }
                        },
                    }}
                />

                <PartnerProjectStatusBar
                    partnersCount={partners.length}
                    emailsCount={emails.length}
                    unreadCount={unreadCount}
                    documentsCount={documents.length}
                    isKanbanBoard={isKanbanBoard}
                    viewMode={viewMode as ViewMode}
                    onBackToCover={() => { setViewTab('copertina'); setOperativeContext(null); }}
                    onChangeViewMode={(m) => setViewMode(m)}
                />
            </header>

            {/* Tab Copertina/Operativa (C3). */}
            <PartnerProjectTabs
                value={viewTab as PartnerProjectTab}
                onChange={(v) => {
                    setViewTab(v);
                    if (v === 'copertina') setOperativeContext(null);
                }}
            />

            {/* 01/10/2026 (F3.A BLOCO 4): card scouting inline — visibile solo su root */}
            {project && !(project as any).parent_id && (
                <div className="pt-2">
                    <ProjectScoutingCard
                        relationId={project.id}
                        payload={(project as any).relationScouting ?? null}
                        onOpenDetail={() => setIsRelationScoutingOpen(true)}
                        onRefreshed={(sc) => setProject((p: any) => p ? { ...p, relationScouting: sc } : p)}
                    />
                </div>
            )}

            {/* 01/10/2026: timeline eventi (tavoli, call, email rilevanti) — visibile su tutti i nodi */}
            {project && (
                <div className="pt-2">
                    <DealTimeline
                        relationId={project.id}
                        mode="admin"
                        authToken={
                            (() => {
                                try {
                                    const raw = localStorage.getItem('pi_session');
                                    const s = raw ? JSON.parse(raw) : null;
                                    return s?.token || '';
                                } catch { return ''; }
                            })()
                        }
                        onRefresh={() => {
                            // ricarica la pagina per aggiornare contatori/notifiche
                            if (typeof window !== 'undefined') window.location.reload();
                        }}
                    />
                </div>
            )}

            {viewTab === 'copertina' && project && (
                <div className="flex-1 overflow-auto bg-[#f8fafc]">
                    <CopertinaPage
                        projectId={project.id}
                        projectName={project.name}
                        projectParentId={project.parent_id ?? null}
                        onBack={() => {
                            if (project.parent_id) window.location.href = `/admin/partner-projects/${project.parent_id}`;
                            else window.location.href = "/admin/partner-projects";
                        }}
                        onOpenOperativa={(ctx) => {
                            setOperativeContext(ctx);
                            setViewTab('operativa');
                        }}
                        onOpenDetail={(person) => setDetailPerson(person)}
                        onOpenCharter={() => setShowCharterInCopertina(true)}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        baseCompenso={(project.charter as any)?.baseCompenso || null}
                        childProjects={childProjects}
                    />
                </div>
            )}

            {viewTab === 'operativa' && <>
            {/* ───── BARRA CONTESTO (sticky) ───── */}
            <div className="bg-white border-b border-[#e2e8f0] px-5 py-2 flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stai operando su</span>
                <Dropdown
                    label={
                        !operativeContext ? "🏢 Tutto il progetto"
                        : operativeContext.type === 'person' ? `👤 ${operativeContext.label}`
                        : operativeContext.type === 'target' ? `🎯 ${operativeContext.label}`
                        : "🏢 Tutto il progetto"
                    }
                    items={[
                        { label: "🏢 Tutto il progetto", hint: "Vista completa del workbench", onClick: () => setOperativeContext(null) },
                        ...(contextOptions.persone.length > 0 ? [{ label: "─── Persone ───", onClick: () => {} } as any] : []),
                        ...contextOptions.persone.map((p: any) => ({
                            label: `👤 ${p.partnerName || p.name}`,
                            hint: p.funzione_progetto ? p.funzione_progetto.replace('_', ' ') : undefined,
                            onClick: () => setOperativeContext({ type: 'person', id: p.id, label: p.partnerName || p.name, partnerId: p.partnerId }),
                        })),
                        ...(contextOptions.targets.length > 0 ? [{ label: "─── Target ───", onClick: () => {} } as any] : []),
                        ...contextOptions.targets.map((t: any) => ({
                            label: `🎯 ${t.partnerName || t.name}`,
                            hint: t.contattoName ? `contatto: ${t.contattoName}` : undefined,
                            onClick: () => setOperativeContext({ type: 'target', id: t.id, label: t.partnerName || t.name }),
                        })),
                    ]}
                />
                {operativeContext && (
                    <button
                        onClick={() => setOperativeContext(null)}
                        className="text-[10px] text-gray-500 hover:text-red-600 transition-colors"
                    >
                        × Reset
                    </button>
                )}
                {operativeContext && (
                    <div className="ml-auto text-[10px] text-gray-400">
                        Le email, note e brief sono filtrati sul contesto selezionato
                    </div>
                )}
            </div>

            {/* ───── COPERTINA FULL-WIDTH: breadcrumb + deal CC + KPI + kanban + split ───── */}
            {(breadcrumbItems.length > 0 || dealCollegato || childProjects.length > 0) && (
                <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-6 py-4 shrink-0 overflow-y-auto max-h-[45vh]">
                    {/* 28/09/2026: breadcrumb gerarchico */}
                    {breadcrumbItems.length > 0 && (
                        <Breadcrumb
                            items={breadcrumbItems.slice(0, -1)}
                            current={breadcrumbItems[breadcrumbItems.length - 1]?.name}
                        />
                    )}

                    {/* 28/09/2026: Deal Command Center (figlio progetto) */}
                    {dealCollegato && (
                        <DealCommandCenter
                            deal={dealCollegato}
                            childProjectId={Number(id)}
                        />
                    )}

                    {/* 28/09/2026: dashboard padre TEE — KPI + Split + Pipeline */}
                    {childProjects.length > 0 && (
                        <section className="space-y-4">
                            {kpiDeal && <KpiDealRow kpi={kpiDeal} />}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <DealsKanban
                                        deals={dealsFlat}
                                        parentProjectId={Number(id)}
                                        authToken={
                                            (() => {
                                                try {
                                                    const raw = localStorage.getItem('pi_session');
                                                    const s = raw ? JSON.parse(raw) : null;
                                                    return s?.token || '';
                                                } catch { return ''; }
                                            })()
                                        }
                                        onDealCreated={() => {
                                            if (typeof window !== 'undefined') {
                                                window.location.reload();
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                </div>
            )}

            {/* ───── MAIN: due colonne ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] flex-1 overflow-y-auto min-h-0">

                {/* ═══ COLONNA SINISTRA: contenuto contestuale alla vista ═══ */}
                <OperativaMain
                    projectId={Number(id)}
                    project={project}
                    emails={filteredEmails}
                    childProjects={childProjects}
                    deals={deals}
                    seenAt={seenAt}
                    operativeContext={operativeContext}
                    viewMode={viewMode}
                    targets={targets}
                    emailState={{
                        openId: openEmailId,
                        bodies: emailBodies,
                        loadingId: loadingBodyId,
                    }}
                    callbacks={{
                        onToggleEmail: toggleEmail,
                        onOpenEmailComposer: () => setIsEmailModalOpen(true),
                        onStartLiveCall: (pid: number, pname: string) => {
                            setLiveCallPartnerId(pid);
                            setLiveCallPartnerName(pname);
                            setLiveCallOpen(true);
                        },
                        onOpenBrief: () => { setBriefType('brief'); setIsBriefModalOpen(true); },
                        onOpenDebrief: () => { setBriefType('debrief'); setIsBriefModalOpen(true); },
                        onSendNote: handleNoteSendEmail,
                    }}
                />

                {/* ═══ COLONNA DESTRA: sidebar con intelligence, parti, documenti, attività ═══ */}
                <OperativaAside
                    data={{
                        partners,
                        documents,
                        emails: filteredEmails,
                        partnerScouting,
                        externalAiUrls,
                    }}
                    state={{
                        activeEngine,
                        openSections,
                        lifecycleFilter,
                        showAddPart,
                        partName,
                        partEmail,
                        partnerResults,
                        selectedExistingPartnerId,
                        savingPart,
                        uploadFile,
                        uploading,
                        uploadError,
                    }}
                    callbacks={{
                        onToggleSection: toggleSection,
                        onSelectEngine: setActiveEngine,
                        onCopyContext: copyContextToClipboard,
                        onToggleAddPart: () => setShowAddPart(!showAddPart),
                        onAddPart: handleAddPart,
                        onPartNameChange: (v) => { setPartName(v); setSelectedExistingPartnerId(null); },
                        onPartEmailChange: setPartEmail,
                        onSelectExistingPartner: handleSelectExistingPartner,
                        onOpenRichPart: () => setIsRichPartOpen(true),
                        onLifecycleFilterChange: setLifecycleFilter,
                        onStartLiveCall: (pid, pname) => {
                            setLiveCallPartnerId(pid);
                            setLiveCallPartnerName(pname);
                            setLiveCallOpen(true);
                        },
                        onScoutingChanged: (pid, s) => setPartnerScouting(prev => ({ ...prev, [pid]: s })),
                        onUploadDocument: handleUploadDocument,
                        onUploadFileChange: setUploadFile,
                    }}
                />
            </div>

            {/* ═══════════════ OVERLAY / MODALS ═══════════════ */}

            </>}

            {/* 01/10/2026 (fix UX): modali sempre montati, indipendenti da viewTab.
                Se apri Scouting/Email/Settings dalla Copertina, il modal ora appare. */}
            <ModalsEmail
                state={{
                    isEmailModalOpen,
                    linkedEventId,
                    availableEvents,
                    subject,
                    message,
                    sending,
                    sendResult,
                    extraEmails,
                    selectedPartnerIds,
                    requiresSignature,
                    requiresDocument,
                    requiresAction,
                    attachedFiles,
                    isSourceModalOpen,
                    isLibraryModalOpen,
                    libraryDocs,
                    loadingLibrary,
                }}
                data={{
                    partners,
                    targets,
                }}
                callbacks={{
                    setIsEmailModalOpen,
                    setLinkedEventId,
                    setSubject,
                    setMessage,
                    setRequiresSignature,
                    setRequiresDocument,
                    setRequiresAction,
                    setExtraEmails,
                    setAttachedFiles,
                    setIsSourceModalOpen,
                    setIsLibraryModalOpen,
                    handleSend,
                    togglePartner,
                }}
            />

            <ModalsCall
                state={{
                    isCreateCallModalOpen,
                    callSubject,
                    callSelectedPartners,
                    isGeneratingCall,
                    activeCallUrl,
                    isBriefModalOpen,
                    briefType,
                    briefData,
                    isPresentationMode,
                    activeOverlayPanel,
                    callNoteText,
                }}
                data={{
                    partners,
                    project,
                    emails,
                    documents,
                }}
                callbacks={{
                    setIsCreateCallModalOpen,
                    setCallSubject,
                    setCallSelectedPartners,
                    handleCreateAndStartCall,
                    setIsBriefModalOpen,
                    setBriefData,
                    handleNoteSendEmail,
                    setIsPresentationMode,
                    setActiveOverlayPanel,
                    setCallNoteText,
                }}
            />

            <ModalsSystem
                state={{
                    isSettingsOpen,
                    isRichPartOpen,
                    showAcqModal,
                    acqName, acqAlias, acqError, acqBusy, acqKind, acqPipeline,
                    isRelationScoutingOpen,
                    liveCallOpen, liveCallPartnerId, liveCallPartnerName,
                    detailPerson, lastCallEnd,
                    kpiTargetsEdit, kpiTargetsBusy, kpiTargetsMsg,
                    partners, emails, documents, project,
                }}
                data={{}}
                callbacks={{
                    setIsSettingsOpen, setIsRichPartOpen, setShowAcqModal,
                    setAcqName, setAcqAlias, setAcqError, setAcqBusy, setAcqKind, setAcqPipeline,
                    setIsRelationScoutingOpen,
                    setLiveCallOpen, setLiveCallPartnerId, setLiveCallPartnerName,
                    setDetailPerson, setLastCallEnd,
                    setKpiTargetsEdit, setKpiTargetsBusy, setKpiTargetsMsg,
                    setPartnerScouting,
                    setIsEmailModalOpen, setSubject, setMessage,
                    setIsBriefModalOpen, setBriefType, setBriefData,
                    setProject, setOperativeContext, load,
                }}
            />
        </div>
    );
}
                               