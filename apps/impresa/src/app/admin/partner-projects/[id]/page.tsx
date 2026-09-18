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
    Loader2, ArrowLeft, Send, ChevronDown, ChevronUp, UserPlus,
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
import AcquisitionKanban from "@/components/admin/AcquisitionKanban";
import RelationScoutingPanel, { type RelationScoutingData } from "@/components/admin/RelationScoutingPanel";

/* ───────────────────────── TYPE DEFINITIONS ───────────────────────── */

// Una "parte" collegata al progetto (utile per raggruppare contatti)
interface Partner {
    id: number;
    name: string;
    ruolo: string | null;
    partnerId: number | null;   // res.partner in Odoo, se mappato
    partnerName: string | null;
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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRichPartOpen, setIsRichPartOpen] = useState(false);
    const [partnerScouting, setPartnerScouting] = useState<Record<number, ScoutingData | null>>({});

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [project, setProject] = useState<{
        id: number; name: string; emailAlias: string | null; parent_id?: number | null;
        child_kind?: string;
    charter?: CharterData | null;
    relationScouting?: RelationScoutingData | null } | null>(null);
    // 18/09/2026 (Denis): se il nodo è un sotto-progetto con pipeline
    // configurata, mostriamo il kanban al posto della pagina standard.
    const [isKanbanBoard, setIsKanbanBoard] = useState(false);
    const [partners, setPartners] = useState<Partner[]>([]);
    // 17/09/2026 (Denis): figli non-parte = rami operativi con pipeline propria
    const [subprojects, setSubprojects] = useState<{ id: number; name: string; emailAlias: string | null; child_kind: string }[]>([]);
    const [emails, setEmails] = useState<EmailLog[]>([]);
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
            // 14/09/2026: segna le email come viste (badge/highlight si spengono al prossimo giro)
            fetch(`/api/admin/partner-projects/${id}/emails-seen`, { method: 'POST' }).catch(() => {});
            setPartners(data.partners || []);
            setSubprojects(data.subprojects || []);

            // Se è un sotto-progetto, controlla se ha una pipeline configurata
            if (data.project?.child_kind === 'sotto_progetto' || data.project?.child_kind === 'pipeline') {
                fetch(`/api/admin/acquisition/${data.project.id}/board`)
                    .then(r => r.json())
                    .then(b => { if (b.success && (b.stages || []).length > 0) setIsKanbanBoard(true); })
                    .catch(() => {});
            }
            setEmails(data.emails || []);
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
    function analyzeSentEmailContent(subject: string, bodyText: string) {
        const fullText = `subject{subject}subject{bodyText}`.toLowerCase();
        const needsSignature = /(rimandare firmat|restituire firmat|inviare copia firmat|inviare il contratto firmat|ti chiedo di firmare|attesa di firma|inviare modulo firmato)/i.test(fullText);
        const needsDocuments = /(gentilmente inviar|potresti inviar|restiamo in attesa d|attendiamo i seguent|inviaci|mancanti|ci servirebb|documentazione|visura|carta d'identit|codice fiscale)/i.test(fullText);
        const needsReply = /(fammi sapere|facci sapere|in attesa di tua|in attesa di un vostro|fammi avere un riscontro|confermac)/i.test(fullText);
        return { needsSignature, needsDocuments, needsReply };
    }

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
    if (isKanbanBoard && project) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-3 mb-4">
                        <Link href={project.parent_id ? `/admin/partner-projects/${project.parent_id}` : "/admin/partner-projects"}
                            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft size={18} className="text-gray-600" />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-[#1a2744] flex items-center gap-2">
                                {project.name}
                                <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">
                                    Pipeline
                                </span>
                            </h1>
                            <p className="text-xs text-gray-500">Trascina le aziende tra le fasi · 📞 per live call · sposta ad altro progetto</p>
                        </div>
                    </div>
                    <AcquisitionKanban relationId={project.id} relationName={project.name} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-[#2b3440] font-sans text-[13px] overflow-hidden">

            {/* ───── HEADER: titolo, alias email, contatori live, switch vista ───── */}
            <header className="bg-white border-b border-[#e2e8f0] px-5 py-2.5 shrink-0 z-20">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Link href={project?.parent_id ? `/admin/partner-projects/${project.parent_id}` : "/admin/partner-projects"}
                            className="text-gray-400 hover:text-gray-800 transition-colors"
                            title={project?.parent_id ? "Torna al progetto padre" : "Torna ai progetti"}>
                            <ArrowLeft size={16} />
                        </Link>
                        <h1 className="text-[15px] font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
                            <span>PROGETTO: {project?.name}</span>
                            {project?.emailAlias && (
                                <span className="text-[11px] font-normal text-gray-400">({project.emailAlias})</span>
                            )}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <CharterEditor
                            projectId={project?.id ?? 0}
                            charter={project?.charter ?? null}
                            onChanged={(c) => setProject(p => p ? { ...p, charter: c } : p)}
                        />

                        {/* 📞 Nuova Call ▾ — pre/in/post in un unico punto */}
                        <Dropdown
                            label="📞 Nuova Call"
                            variant="primary"
                            items={[
                                { label: "🎥 Video + Live Note", hint: "Apre Discuss + drawer note", onClick: () => setIsCreateCallModalOpen(true) },
                                { label: "📝 Solo Live Note", hint: "Call già iniziata (telefono)", onClick: () => setLiveCallOpen(true) },
                                { label: "📋 Prepara Brief", hint: "Pre-call, prima di chiamare", onClick: () => { setBriefType('brief'); setIsBriefModalOpen(true); } },
                            ]}
                        />

                        {/* 🔍 Scouting ▾ */}
                        <Dropdown
                            label="🔍 Scouting"
                            items={[
                                { label: "🏢 Scouting Azienda", hint: "Per una parte del progetto", onClick: () => setShowAddPart(true) },
                                { label: "🎯 Scouting Relazione", hint: "Profilo target del progetto", onClick: () => setIsRelationScoutingOpen(true) },
                            ]}
                        />

                        {/* 🎤 Presenta */}
                        <button
                            onClick={() => setIsPresentationMode(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                            title="Modalità Presentazione"
                        >
                            <Monitor size={13} />
                            Presenta
                        </button>

                        {/* + Crea sotto-progetto — solo su progetto radice */}
                        {!project?.parent_id && (
                            <Dropdown
                                label="+ Nuovo"
                                items={[
                                    { label: "📁 Crea sotto-progetto", onClick: () => setShowAcqModal(true) },
                                ]}
                            />
                        )}

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-1.5 text-gray-400 hover:text-[#1a7fa8] rounded transition-colors cursor-pointer"
                            title="Impostazioni Circuito"
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                </div>

                {/* Barra di stato: KPI a colpo d'occhio (parti / email / atti) */}
                <div className="flex items-center justify-between text-[11.5px] border-t border-[#f1f5f9] pt-2">
                    <div className="flex items-center gap-4 text-gray-500 font-medium">
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Attivo
                        </span>
                        <span className="flex items-center gap-1">👥 {partners.length} parti</span>
                        <span className="flex items-center gap-1">✉ {emails.length} email</span>
                        <span className="flex items-center gap-1">📎 {documents.length} atti</span>
                    </div>

                    {/* Toggle vista: Workbench (operativo) / Lavagna (strategica) */}
                    <div className="flex bg-[#f1f5f9] p-0.5 rounded text-[11px] font-medium">
                        <button
                            onClick={() => setViewMode('workbench')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer transition-all ${viewMode === 'workbench' ? 'bg-white text-[#0f172a] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <Table size={12} />

                            <span>WORKBENCH</span>
                        </button>
                        <button
                            onClick={() => setViewMode('lavagna')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer transition-all ${viewMode === 'lavagna' ? 'bg-white text-[#0f172a] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <LayoutGrid size={12} />
                            <span>LAVAGNA STRATEGICA</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ───── MAIN: due colonne ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] flex-1 overflow-hidden">

                {/* ═══ COLONNA SINISTRA: contenuto contestuale alla vista ═══ */}
                <main className="flex flex-col min-w-0 bg-white overflow-y-auto p-6 border-r border-[#e2e8f0]">
                    {viewMode === 'workbench' ? (
                        /* WORKBENCH: flusso email + azioni operative (call, presentazione) */
                        <section className="space-y-6">
                            <WorkAreaPanel projectId={Number(id)} />

                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h2 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1.5">
                                    <FileText size={13} /> Comunicazioni & Flusso Email
                                </h2>
                                <button
                                    onClick={() => setIsEmailModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors cursor-pointer"
                                >
                                    <Send size={12} />
                                    Scrivi Email
                                </button>
                            </div>

                            {/* Flusso email: accordion con badge "in attesa di..." per le USCITE */}
                            {emails.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nessuna email registrata.</p>
                            ) : (
                                <div className="space-y-1">
                                    {emails.map((e) => {
                                        const isOut = e.direction === 'inviata';
                                        // 14/09/2026: email arrivata DOPO l'ultima vista -> evidenza ambra
                                        const isNew = !seenAt || (!!e.date && e.date > seenAt);
                                        const bodyText = emailBodies[e.id] || '';
                                        // Analisi solo sulle inviate: ci dice COSA abbiamo chiesto
                                        const sentAnalysis = isOut ? analyzeSentEmailContent(e.subject, bodyText) : null;

                                        return (
                                            <div key={e.id} className={`border-b border-gray-50 last:border-0 py-2 rounded ${isNew ? 'bg-amber-50 border border-amber-200' : ''}`}>
                                                <button
                                                    onClick={() => toggleEmail(e.id)}
                                                    className="w-full flex items-start justify-between text-left hover:bg-[#f8fafc] p-1.5 rounded transition-colors"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[10px] font-semibold ${isOut ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                                {isOut ? '📤 OUT' : '📥 IN'}
                                                            </span>
                                                            <span className="text-xs font-medium text-[#0f172a]">{e.subject}</span>
                                                            {isNew && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-white">🆕 NUOVA</span>}

                                                            {/* Badge di tracking: firma / documenti / riscontro richiesti */}
                                                            {isOut && sentAnalysis && <div className="flex items-center gap-1.5 ml-1">
                                                                {sentAnalysis.needsSignature && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                                                        ✍️ In Attesa di Firma
                                                                    </span>
                                                                )}
                                                                {sentAnalysis.needsDocuments && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                                                                        📄 In Attesa Documenti
                                                                    </span>
                                                                )}
                                                                {sentAnalysis.needsReply && !sentAnalysis.needsSignature && !sentAnalysis.needsDocuments && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                                                                        ⏳ In Attesa Riscontro
                                                                    </span>
                                                                )}
                                                            </div>}
                                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                                {isOut ? "a: " + e.recipientEmails : "da: " + e.senderEmail} · {e.date ? new Date(e.date).toLocaleString('it-IT') : ''}
                                                            </div>
                                                    </div>
                                                    </div>
                                                    {openEmailId === e.id ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                                                </button>

                                                {/* Corpo email espanso: banner azione + HTML sanitizzato */}
                                                {openEmailId === e.id && (
                                                    <div className="mt-2 pl-6 pr-2 pb-2 space-y-2">
                                                        {isOut && sentAnalysis && (sentAnalysis.needsSignature || sentAnalysis.needsDocuments) && (
                                                            <div className="p-2.5 rounded-md bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-base">📌</span>
                                                                    <span>
                                                                        <strong>Azione Richiesta Inviata:</strong> In questa email hai richiesto
                                                                        {sentAnalysis.needsSignature && sentAnalysis.needsDocuments
                                                                            ? ' la firma e l’invio di documenti.'
                                                                            : sentAnalysis.needsSignature
                                                                                ? ' la firma del documento.'
                                                                                : ' l’invio di documenti.'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {loadingBodyId === e.id ? (
                                                            <Loader2 size={14} className="animate-spin text-gray-400" />
                                                        ) : emailBodies[e.id] ? (
                                                            <div
                                                                className="prose prose-xs max-w-none text-gray-600 text-[12px] bg-[#f8fafc] p-3 rounded"
                                                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailBodies[e.id] as string) }}
                                                            />
                                                        ) : (
                                                            <p className="text-xs text-gray-400">Nessun contenuto disponibile.</p>
                                                        )}

                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    ) : (
                        /* LAVAGNA STRATEGICA: brief/debrief + board note del progetto */
                        <section className="h-full flex flex-col">
                            <div className="border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
                                <h2 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                                    Lavagna Strategica Progetto
                                </h2>
                                <div className="flex items-center gap-2">
                                    {/* Brief = prima dell'azione, Debrief = dopo: ciclo PDCA/Deming */}
                                    <button
                                        onClick={() => { setBriefType('brief'); setIsBriefModalOpen(true); }}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        📋 Compila Brief
                                    </button>
                                    <button
                                        onClick={() => { setBriefType('debrief'); setIsBriefModalOpen(true); }}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        🔍 Compila Debrief
                                    </button>
                                </div>
                            </div>

                            {project && (
                                <NotesBoard resModel="erpv6.tracking.relation" resId={project.id} onSendEmail={handleNoteSendEmail} />
                            )}
                        </section>
                    )}
                </main>

                {/* ═══ COLONNA DESTRA: sidebar con intelligence, parti, documenti, attività ═══ */}
                <aside className="bg-[#f8fafc] flex flex-col h-full overflow-y-auto p-5 space-y-6">

                    {/* INTELLIGENCE: switch motore + azioni di analisi + router esterno */}
                    <section>
                        <div onClick={() => toggleSection('intelligence')} className="flex items-center justify-between mb-2 border-b border-gray-200/60 pb-2 cursor-pointer select-none">
                            <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
                                <Zap size={13} className="text-[#1a7fa8]" /> INTELLIGENCE
                            </h2>
                            <ChevD size={14} className={`text-gray-400 transition-transform ${openSections.intelligence ? '' : '-rotate-90'}`} />
                        </div>
                        {openSections.intelligence && (
                        <>
                        <div className="flex items-center gap-1 mb-3">
                                {(['susanna', 'chatgpt', 'gemini', 'onalpha'] as IntelligenceEngine[]).map((engine) => (
                                    <button
                                        key={engine}
                                        onClick={() => setActiveEngine(engine)}
                                        className={`px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer transition-colors ${activeEngine === engine ? 'bg-[#0f172a] text-white' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {engine === 'susanna' ? 'Susanna' : engine === 'chatgpt' ? 'ChatGPT' : engine === 'gemini' ? 'Gemini' : 'OnAlpha'}
                                    </button>
                                ))}
                            </div>

                        <div className="space-y-1.5">
                            {/* Ogni azione copia prima il contesto: pronto da incollare nell'AI */}
                            {[
                                { label: '✦ Analizza Progetto' },
                                { label: '✉ Riassumi Email' },
                                { label: '📄 Analizza Documenti' },
                            ].map((action) => (
                                <button
                                    key={action.label}
                                    onClick={copyContextToClipboard}
                                    className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-white border border-gray-200/80 text-xs text-[#0f172a] hover:bg-gray-50 transition-colors cursor-pointer font-medium"
                                >
                                    <span>{action.label}</span>
                                    <Sparkles size={12} className="text-amber-500" />
                                </button>
                            ))}

                            {/* Solo per motori esterni: bottone di lancio con contesto copiato */}
                            {activeEngine !== 'susanna' && (
                                <a
                                    href={externalAiUrls[activeEngine]}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={copyContextToClipboard}
                                    className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-[#1a7fa8] text-white text-xs font-semibold hover:bg-[#156688] transition-colors cursor-pointer"
                                >
                                    <span>Apri {activeEngine === 'chatgpt' ? 'ChatGPT' : activeEngine === 'gemini' ? 'Gemini' : 'OnAlpha'} ↗</span>
                                </a>
                            )}
                        </div>
                        </>
                        )}
                    </section>

                    {/* SOTTO-PROGETTI: rami operativi figli con pipeline propria
                        (17/09/2026 Denis). Visibili solo sul progetto radice. */}
                    {!project?.parent_id && (
                    <section className="border-t border-gray-200/60 pt-4">
                        <div onClick={() => toggleSection('sottoprogetti')} className="flex items-center justify-between mb-2.5 cursor-pointer select-none">
                            <h2 className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1.5">
                                <Layers size={13} /> Sotto-progetti
                            </h2>
                            <button onClick={(ev) => { ev.stopPropagation(); setShowAcqModal(true); }} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Crea sotto-progetto">
                                <Plus size={14} />
                            </button>
                            <ChevD size={14} className={`text-gray-400 transition-transform ${openSections.sottoprogetti ? '' : '-rotate-90'}`} />
                        </div>
                        {openSections.sottoprogetti && (
                        <>
                        {subprojects.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Nessun sotto-progetto. Premi + per crearne uno (es. Acquisizione Aziende).</p>
                        ) : (
                            <div className="space-y-1.5">
                                {subprojects.map((sp) => (
                                    <Link key={sp.id} href={`/admin/partner-projects/${sp.id}`}
                                        className="flex items-center justify-between bg-indigo-50/50 hover:bg-indigo-100/60 rounded border border-indigo-100 p-2.5 text-xs transition-colors">
                                        <div>
                                            <div className="font-semibold text-[#0f172a]">{sp.name}</div>
                                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                                                <span className="px-1.5 py-0.5 rounded bg-indigo-200/50 text-indigo-800 font-medium">
                                                    {sp.child_kind === 'pipeline' ? 'pipeline' : 'sotto-progetto'}
                                                </span>
                                                {sp.emailAlias && <span className="font-mono">{sp.emailAlias}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-indigo-400" />
                                    </Link>
                                ))}
                            </div>
                        )}
                        </>
                        )}
                    </section>
                    )}

                    {/* PARTI: elenco + form inline con autocomplete res.partner */}
                    <section className="border-t border-gray-200/60 pt-4">
                        <div onClick={() => toggleSection('parti')} className="flex items-center justify-between mb-2.5 cursor-pointer select-none">
                            <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">Persone / Parti</h2>
                            <button onClick={(ev) => { ev.stopPropagation(); setShowAddPart(!showAddPart); }} className="text-gray-600 hover:text-black cursor-pointer">
                                <UserPlus size={14} />
                            </button>
                            <ChevD size={14} className={`text-gray-400 transition-transform ${openSections.parti ? '' : '-rotate-90'}`} />
                        </div>
                        {openSections.parti && (
                        <>

                        {showAddPart && (
                            <form onSubmit={handleAddPart} className="bg-white rounded p-3 mb-3 space-y-2 border border-gray-200">
                                <div className="relative">
                                    <input
                                        required placeholder="Nome *"
                                        value={partName}
                                        onChange={(e) => { setPartName(e.target.value); setSelectedExistingPartnerId(null); }}
                                        className="w-full px-2.5 py-1 rounded border border-gray-200 text-xs"
                                    />
                                    {/* Dropdown risultati autocomplete (debounced) */}
                                    {partnerResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-36 overflow-y-auto">
                                            {partnerResults.map((p) => (
                                                <button
                                                    type="button" key={p.id} onClick={() => handleSelectExistingPartner(p)}
                                                    className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50"
                                                >
                                                    <div className="font-medium text-gray-800">{p.name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="email" placeholder="Email" value={partEmail} onChange={(e) => setPartEmail(e.target.value)} className="w-full px-2.5 py-1 rounded border border-gray-200 text-xs" />
                                <button type="submit" disabled={savingPart} className="w-full py-1 rounded bg-[#0f172a] text-white text-xs font-medium">Aggiungi</button>
                                <button type="button" onClick={() => setIsRichPartOpen(true)}
                                    className="w-full py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                                    ➕ Scheda completa (persona + azienda)
                                </button>
                            </form>
                        )}

                        {partners.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Nessuna parte collegata.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {partners.map((p) => (
                                    <div key={p.id} className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-100">
                                        <div className="font-semibold text-[#0f172a]">{p.partnerName || p.name}</div>
                                        {/* Pannello AI per singola parte (analisi del rapporto) */}
                                        <div className="mt-1 flex items-center gap-1">
                                            {p.partnerId && (
                                                <>
                                                <button
                                                    onClick={() => { setLiveCallPartnerId(p.partnerId!); setLiveCallPartnerName(p.partnerName || p.name); setLiveCallOpen(true); }}
                                                    className="text-red-600 hover:text-red-800 cursor-pointer"
                                                    title="Avvia Live Call"
                                                >
                                                    <Phone size={12} />
                                                </button>
                                                <ScoutingModal
                                                    partnerId={p.partnerId}
                                                    partnerName={p.partnerName || p.name}
                                                    scouting={partnerScouting[p.partnerId] ?? null}
                                                    onChanged={(s) => setPartnerScouting(prev => ({ ...prev, [p.partnerId!]: s }))}
                                                />
                                                </>
                                            )}
                                            <HeinrichPanel resModel="erpv6.tracking.relation" resId={p.id} compact />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </>
                        )}
                    </section>

                    {/* DOCUMENTI: download list + upload form */}
                    <section className="border-t border-gray-200/60 pt-4">
                        <div onClick={() => toggleSection('documenti')} className="flex items-center justify-between mb-2.5 cursor-pointer select-none">
                            <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
                                <FileText size={13} /> Documenti & Atti
                            </h2>
                            <ChevD size={14} className={`text-gray-400 transition-transform ${openSections.documenti ? '' : '-rotate-90'}`} />
                        </div>
                        {openSections.documenti && (
                        <>

                        {documents.length === 0 ? (
                            <p className="text-xs text-gray-400 italic mb-2">Nessun documento caricato.</p>
                        ) : (
                            <div className="space-y-1 mb-3">
                                {documents.map((d) => (
                                    <a
                                        key={d.id}
                                        href={`/api/admin/attachments/${d.id}/download`}
                                        className="flex items-center justify-between p-1.5 rounded bg-white hover:bg-gray-100/70 border border-gray-100 text-xs text-gray-800 transition-colors"
                                    >
                                        <span className="truncate font-medium">{d.name}</span>
                                        <Download size={12} className="text-gray-400 shrink-0 ml-2" />
                                    </a>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleUploadDocument} className="space-y-2">
                            <input
                                type="file"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                className="w-full text-[11px] text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-xs file:cursor-pointer"
                            />
                            {uploadError && (
                                <p className="text-[11px] text-red-600">{uploadError}</p>
                            )}
                            <button
                                type="submit"
                                disabled={!uploadFile || uploading}
                                className="w-full py-1.5 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                {uploading ? 'Caricamento...' : 'Carica Documento'}
                            </button>
                        </form>
                        </>
                        )}
                    </section>

                    {/* ATTIVITÀ RECENTI: mini-feed = ultime 3 email + 2 documenti */}
                    <section className="border-t border-gray-200/60 pt-4">
                        <div onClick={() => toggleSection('attivita')} className="flex items-center justify-between mb-2.5 cursor-pointer select-none">
                            <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
                                <Activity size={13} className="text-[#1a7fa8]" /> Attività Recenti
                            </h2>
                            <ChevD size={14} className={`text-gray-400 transition-transform ${openSections.attivita ? '' : '-rotate-90'}`} />
                        </div>
                        {openSections.attivita && (
                        <>
                        <div className="space-y-2">
                            {emails.slice(0, 3).map((e) => (
                                <div key={`act-${e.id}`} className="text-[11px] text-gray-500 flex items-start gap-2">
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${e.direction === 'inviata' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                                    <span className="truncate">
                                        {e.direction === 'inviata' ? 'Email inviata:' : 'Email ricevuta:'} {e.subject}
                                    </span>
                                </div>
                            ))}
                            {documents.slice(0, 2).map((d) => (
                                <div key={`act-doc-${d.id}`} className="text-[11px] text-gray-500 flex items-start gap-2">
                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    <span className="truncate">Documento caricato: {d.name}</span>
                                </div>
                            ))}
                            {emails.length === 0 && documents.length === 0 && (
                                <p className="text-xs text-gray-400 italic">Nessuna attività recente.</p>
                            )}
                        </div>
                        </>
                        )}
                    </section>
                </aside>
            </div>

            {/* ═══════════════ OVERLAY / MODALS ═══════════════ */}

            {/* MODAL COMPOSER EMAIL: destinatari multipli, flag, allegati dual-source */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setIsEmailModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#0f172a]">Nuova Email dal Progetto</h3>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-800 cursor-pointer">✕</button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                const ok = await handleSend(e);
                                if (ok) setIsEmailModalOpen(false); // chiudi solo se invio riuscito
                            }}
                            className="p-5 space-y-3 overflow-y-auto"
                        >
                            {/* Checkbox delle parti: destinatari curati dal progetto */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Parti Destinatarie</label>
                                {partners.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">Nessuna parte collegata al progetto.</p>
                                ) : (
                                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded p-2">
                                        {partners.map((p) => (
                                            <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPartnerIds.includes(p.id)}
                                                    onChange={() => togglePartner(p.id)}
                                                    className="accent-[#0f172a]"
                                                />
                                                <span className="font-medium text-[#0f172a]">{p.partnerName || p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Email extra libere (non presenti come parti) */}
                            <input
                                type="text"
                                placeholder="Email extra (separate da virgola)"
                                value={extraEmails}
                                onChange={(e) => setExtraEmails(e.target.value)}
                                className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs"
                            />

                            <input required type="text" placeholder="Oggetto *" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
                            <textarea required placeholder="Messaggio *" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />

                            {/* Flag semantici: alimentano il tracking dei pending (stesso contratto API dell'analisi heuristica) */}
                            <div className="flex items-center gap-4 flex-wrap bg-[#f8fafc] border border-gray-100 rounded p-2">
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input type="checkbox" checked={requiresSignature} onChange={(e) => setRequiresSignature(e.target.checked)} className="accent-amber-600" />
                                    ✍️ Richiede Firma
                                </label>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input type="checkbox" checked={requiresDocument} onChange={(e) => setRequiresDocument(e.target.checked)} className="accent-blue-600" />
                                    📄 Richiede Documenti
                                </label>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input type="checkbox" checked={requiresAction} onChange={(e) => setRequiresAction(e.target.checked)} className="accent-emerald-600" />
                                    ⏳ Richiede Riscontro
                                </label>
                            </div>

                            {/* Allegati: chips rimovibili + due sorgenti (PC / Libreria) */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Allegati</label>
                                {attachedFiles.length > 0 && (
                                    <div className="space-y-1 mb-2">
                                        {attachedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1">
                                                <span className="truncate">{f.source === 'library' ? '📚 ' : '📎 '}{f.name}</span>
                                                <button type="button" onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 cursor-pointer">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                                        <UploadCloud size={12} />
                                        Da PC
                                        <input
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length) {
                                                    setAttachedFiles((prev) => [
                                                        ...prev,
                                                        ...files.map((f) => ({ name: f.name, fileRaw: f, source: 'local' as const })),
                                                    ]);
                                                }
                                                e.target.value = ''; // reset input per ri-selezionare lo stesso file
                                            }}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsSourceModalOpen(true)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50"
                                    >
                                        📚 Da Libreria Progetto
                                    </button>
                                </div>
                            </div>

                            {sendResult && (
                                <p className={`text-xs ${sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{sendResult.text}</p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer"
                                >
                                    {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                    {sending ? 'Invio...' : 'Invia Email'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL SORGENTE: выбора tra PC e Libreria (estendibile ad altre sorgenti) */}
            {isSourceModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIsSourceModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-[#0f172a]">Scegli la sorgente</h3>
                        <button
                            onClick={() => { setIsSourceModalOpen(false); setIsLibraryModalOpen(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded border border-gray-200 text-xs font-medium hover:bg-gray-50 cursor-pointer"
                        >
                            📚 Libreria Progetto
                        </button>
                        <button onClick={() => setIsSourceModalOpen(false)} className="w-full px-3 py-1.5 rounded text-xs text-gray-500 hover:bg-gray-50 cursor-pointer">Annulla</button>
                    </div>
                </div>
            )}

            {/* MODAL LIBRERIA: lista lazy dei documenti già su Odoo → aggancio per id (no ri-upload) */}
            {isLibraryModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIsLibraryModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#0f172a]">Libreria Progetto</h3>
                            <button onClick={() => setIsLibraryModalOpen(false)} className="text-gray-400 hover:text-gray-800 cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-1">
                            {loadingLibrary ? (
                                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                            ) : libraryDocs.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nessun documento in libreria.</p>
                            ) : (
                                libraryDocs.map((doc) => (
                                    <button
                                        key={doc.id}
                                        onClick={() => {
                                            setAttachedFiles((prev) => [
                                                ...prev,
                                                { id: doc.id, name: doc.name, url: doc.url, source: 'library' as const },
                                            ]);
                                            setIsLibraryModalOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between text-left px-3 py-2 rounded border border-gray-100 hover:bg-gray-50 text-xs cursor-pointer"
                                    >
                                        <span className="truncate font-medium text-[#0f172a]">{doc.name}</span>
                                        <span className="text-gray-400 ml-2">＋</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL NUOVA CALL: oggetto + inviti → crea mail.channel su Odoo → popup */}
            {isCreateCallModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setIsCreateCallModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-[#0f172a]">Nuova Call Odoo Discuss</h3>
                        <input
                            type="text"
                            placeholder="Oggetto della call"
                            value={callSubject}
                            onChange={(e) => setCallSubject(e.target.value)}
                            className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs"
                        />
                        {partners.length > 0 && (
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Invita Parti</label>
                                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded p-2">
                                    {partners.map((p) => (
                                        <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1">
                                            <input
                                                type="checkbox"
                                                checked={callSelectedPartners.includes(p.id)}
                                                onChange={() =>
                                                    setCallSelectedPartners((prev) =>
                                                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                                    )
                                                }
                                                className="accent-emerald-600"
                                            />
                                            <span className="font-medium">{p.partnerName || p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeCallUrl && (
                            <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-800 break-all">
                                Canale attivo: <a href={activeCallUrl} target="_blank" rel="noreferrer" className="underline">{activeCallUrl}</a>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setIsCreateCallModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">Chiudi</button>
                            <button
                                onClick={handleCreateAndStartCall}
                                disabled={isGeneratingCall}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                            >
                                {isGeneratingCall ? <Loader2 size={12} className="animate-spin" /> : <Video size={12} />}
                                {isGeneratingCall ? 'Creazione...' : activeCallUrl ? 'Riapri Call' : 'Crea e Avvia'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL BRIEF/DEBRIEF: compila → invia come email a tutte le parti */}
            {isBriefModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setIsBriefModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-[#0f172a]">
                            {briefType === 'brief' ? '📋 Compila Brief' : '🔍 Compila Debrief'}
                        </h3>
                        <input type="text" placeholder={briefType === 'brief' ? 'Obiettivo del progetto' : 'Esito principale'} value={briefData.objective} onChange={(e) => setBriefData((prev) => ({ ...prev, objective: e.target.value }))} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
                        <input type="text" placeholder={briefType === 'brief' ? 'Target audience' : 'Punti di attenzione emersi'} value={briefData.targetAudience} onChange={(e) => setBriefData((prev) => ({ ...prev, targetAudience: e.target.value }))} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
                        <textarea placeholder={briefType === 'brief' ? 'Deliverables chiave' : 'Azioni correttive / follow-up'} value={briefData.keyDeliverables} onChange={(e) => setBriefData((prev) => ({ ...prev, keyDeliverables: e.target.value }))} rows={3} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />
                        <textarea placeholder="Rischi / Note" value={briefData.risksOrNotes} onChange={(e) => setBriefData((prev) => ({ ...prev, risksOrNotes: e.target.value }))} rows={2} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={() => setIsBriefModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">Annulla</button>
                            <button
                                onClick={async () => {
                                    // Serializza i campi in testo (salta le righe vuote) → invia alle parti
                                    const bodyText = [
                                        `Obiettivo/Esito: ${briefData.objective}`,
                                        `Target/Attenzioni: ${briefData.targetAudience}`,
                                        `briefType===′brief′?′Deliverables′:′Follow−up′:{briefType === 'brief' ? 'Deliverables' : 'Follow-up'}:briefType===′brief′?′Deliverables′:′Follow−up′:{briefData.keyDeliverables}`,
                                        `Note: ${briefData.risksOrNotes}`,
                                    ].filter((l) => !l.endsWith(': ') && !l.endsWith(':')).join('\n');

                                    const result = await handleNoteSendEmail({
                                        title: briefType === 'brief' ? `Brief – project?.name∣∣′′‘:‘Debrief–{project?.name || ''}` : `Debrief –project?.name∣∣′′‘:‘Debrief–{project?.name || ''}`,
                                        body: bodyText,
                                        note_type: briefType,
                                    });
                                    if (result.ok) {
                                        setIsBriefModalOpen(false);
                                        setBriefData({ objective: '', targetAudience: '', keyDeliverables: '', risksOrNotes: '' });
                                    } else {
                                        alert(result.text);
                                    }
                                }}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b] cursor-pointer"
                            >
                                <Send size={12} />
                                Salva e Invia alle Parti
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALITÀ PRESENTAZIONE: overlay full-screen scuro per call/meeting.
                Default = slide info progetto. Overlay note = cattura + invio via email. */}
            {isPresentationMode && (
                <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col text-white">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">{project?.name}</h2>
                            <p className="text-xs text-white/50">Modalità Presentazione · {partners.length} parti collegate</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'notes' ? null : 'notes')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${activeOverlayPanel === 'notes' ? 'bg-white text-[#0f172a]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                <FileText size={13} /> Note Call
                            </button>
                            <button
                                onClick={() => { setIsPresentationMode(false); setActiveOverlayPanel(null); }}
                                className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                            >
                                Esci (✕)
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                        {activeOverlayPanel === 'notes' ? (
                            /* Pannello note call: cattura veloce, copia o invio alle parti */
                            <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-lg p-6 space-y-3 backdrop-blur">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">Note di Call</h3>
                                <textarea
                                    value={callNoteText}
                                    onChange={(e) => setCallNoteText(e.target.value)}
                                    rows={8}
                                    placeholder="Annota i punti chiave della call..."
                                    className="w-full bg-white/10 border border-white/20 rounded p-3 text-sm text-white placeholder-white/40 resize-y focus:outline-none focus:ring-1 focus:ring-white/40"
                                />
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(callNoteText)}
                                        className="px-3 py-1.5 rounded bg-white/10 text-xs font-medium hover:bg-white/20 cursor-pointer"
                                    >
                                        Copia negli appunti
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const result = await handleNoteSendEmail({
                                                title: `Note Call – ${project?.name || ''}`,
                                                body: callNoteText,
                                                note_type: 'call_notes',
                                            });
                                            if (result.ok) {
                                                setCallNoteText('');
                                                setActiveOverlayPanel(null);
                                            } else {
                                                alert(result.text);
                                            }
                                        }}
                                        disabled={!callNoteText.trim()}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                                    >
                                        <Send size={12} /> Invia come Email
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Slide "copertina" del progetto: dati essenziali + chips parti */
                            <div className="text-center space-y-4 max-w-xl">
                                <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
                                {project?.emailAlias && <p className="text-white/50 text-sm font-mono">{project.emailAlias}</p>}
                                <div className="flex items-center justify-center gap-6 text-sm text-white/70 pt-4">
                                    <span>👥 {partners.length} parti</span>
                                    <span>✉ {emails.length} email</span>
                                    <span>📎 {documents.length} atti</span>
                                </div>
                                {partners.length > 0 && (
                                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                                        {partners.map((p) => (
                                            <span key={p.id} className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs">
                                                {p.partnerName || p.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL IMPOSTAZIONI: read-only del circuito (progetto, alias, contatori) */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setIsSettingsOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-[#0f172a]">Impostazioni Circuito</h3>
                        <div className="space-y-2 text-xs text-gray-600">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <span>Progetto</span>
                                <span className="font-semibold text-[#0f172a]">{project?.name}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <span>Alias Email</span>
                                <span className="font-mono text-[11px] text-[#1a7fa8]">{project?.emailAlias || 'N/D'}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <span>Parti collegate</span>
                                <span className="font-semibold">{partners.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Documenti</span>
                                <span className="font-semibold">{documents.length}</span>
                            </div>
                        </div>
                        <button onClick={() => setIsSettingsOpen(false)} className="w-full py-1.5 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] cursor-pointer">
                            Chiudi
                        </button>
                    </div>
                </div>
            )}
            {isRichPartOpen && (
                <RichPartModal
                    projectId={Number(id)}
                    onClose={() => setIsRichPartOpen(false)}
                    onAdded={load}
                />
            )}
            {showAcqModal && (
                
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="mb-3 text-sm font-bold">Crea sotto-progetto</h3>

                        <label className="block text-xs font-semibold text-gray-600">Tipo di sotto-progetto</label>
                        <select value={acqKind} onChange={(e) => setAcqKind(e.target.value)}
                            className="mb-3 w-full rounded border px-2 py-1.5 text-sm">
                            <option value="sotto_progetto">Sotto-progetto (generico)</option>
                            <option value="pipeline">Pipeline operativa</option>
                        </select>

                        <label className="block text-xs font-semibold text-gray-600">Pipeline di default</label>
                        <select value={acqPipeline} onChange={(e) => setAcqPipeline(e.target.value)}
                            className="mb-3 w-full rounded border px-2 py-1.5 text-sm">
                            <option value="acquisition">Acquisizione Aziende (scouting → contatto → risultato)</option>
                            <option value="">Nessuna (personalizzata)</option>
                        </select>

                        <label className="block text-xs font-semibold text-gray-600">Nome sotto-progetto</label>
                        <input value={acqName} onChange={(e) => setAcqName(e.target.value)}
                            placeholder="Acquisizione Aziende" className="mb-3 w-full rounded border px-2 py-1.5 text-sm" />
                        <label className="block text-xs font-semibold text-gray-600">Alias email (opzionale)</label>
                        <div className="mb-4 flex items-center gap-1">
                            <input value={acqAlias} onChange={(e) => setAcqAlias(e.target.value)}
                                placeholder={String(project!.id) + '-acq'} className="w-full rounded border px-2 py-1.5 text-sm" />
                            <span className="text-xs text-gray-500">@v6sviluppoimpresa.it</span>
                        </div>
                        {acqError && <p className="mb-2 text-xs text-red-600">{acqError}</p>}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAcqModal(false)} className="rounded px-3 py-1.5 text-xs text-gray-600">Annulla</button>
                            <button onClick={async () => {
                                setAcqError(null); setAcqBusy(true);
                                try {
                                    const res = await fetch(`/api/admin/partner-projects/${project!.id}/start-acquisition`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            name: acqName,
                                            emailAlias: acqAlias,
                                            kind: acqKind,
                                            pipelineTemplate: acqPipeline || null,
                                        }),
                                    });
                                    const j = await res.json();
                                    if (!res.ok) throw new Error(j.error || 'Errore');
                                    setShowAcqModal(false);
                                    load(); // ricarica per vedere il figlio nell'albero
                                } catch (e: any) { setAcqError(e.message); }
                                finally { setAcqBusy(false); }
                            }} disabled={acqBusy || !acqName.trim()}
                                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                                {acqBusy ? 'Creazione…' : 'Crea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRelationScoutingOpen && project && (
                <RelationScoutingPanel
                    relationId={project.id}
                    relationName={project.name}
                    scouting={project.relationScouting ?? null}
                    onClose={() => setIsRelationScoutingOpen(false)}
                    onSaved={(s) => setProject((p) => p ? { ...p, relationScouting: s } : p)}
                />
            )}

            {liveCallOpen && liveCallPartnerId && (
                <LiveCallDrawer
                    partnerId={liveCallPartnerId}
                    partnerName={liveCallPartnerName}
                    relationId={project?.id}
                    scouting={partnerScouting[liveCallPartnerId] ?? null}
                    onClose={() => { setLiveCallOpen(false); setLiveCallPartnerId(null); }}
                    onScoutingUpdated={(s) => setPartnerScouting(prev => ({ ...prev, [liveCallPartnerId!]: s }))}
                />
            )}

        </div>
    );
}
                               