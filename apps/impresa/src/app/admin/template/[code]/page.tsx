"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  ArrowLeft, Save, Play, Rocket, AlertCircle, CheckCircle2,
  RefreshCw, Code2, FileText, Settings, ChevronDown, ChevronRight,
  Clock, AlertTriangle, Loader2
} from "lucide-react";

type Template = {
  id: number;
  code: string;
  name: string;
  version: string;
  category: string | null;
  description: string | null;
  language: string;
  pageSize: string;
  orientation: string;
  requiredFields: any;
  hasSource: boolean;
  hasDraft: boolean;
  sourcePromotedAt: string | null;
  source: string;
  sourceDraft: string;
};

const DEFAULT_DATA = {
  data_generazione: "26/09/2026",
  v6_sede: "Via Roma 1, 20100 Milano (MI)",
  v6_piva: "12345678901",
  consulente_nome: "Christian Girardi",
  consulente_email: "info@christiangirardi.it",
  consulente_cf: "MRTMTT91D08F205J",
  consulente_piva: "",
  consulente_indirizzo: "Via Test 1, 20100 Milano",
  progetto_nome: "Progetto TEE",
  consulente_pct: "10.00",
  base_tipo: "fisso_unita",
  base_valore: "2.00",
  base_unita: "TEE",
  quota_unitaria: "0.2000",
  riserva_pct: "85.00",
};

export default function TemplateStudioPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Editor state
  const [source, setSource] = useState("");
  const [dataJson, setDataJson] = useState(JSON.stringify(DEFAULT_DATA, null, 2));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);

  // Compile state
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileResult, setCompileResult] = useState<{ ok: boolean; durationMs: number; errors?: any[] } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) { window.location.href = "/login"; return; }
    const u = JSON.parse(session);
    setUser(u);
    loadTemplate(u);
  }, [code]);

  const loadTemplate = async (u?: any) => {
    const session = u || user;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/templates/${code}`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Errore"); return; }
      const t = data.template;
      setTemplate(t);
      setSource(t.sourceDraft || t.source || "");
      // Se il template ha required_fields, usalo come base per data
      if (t.requiredFields && Object.keys(t.requiredFields).length > 0) {
        const rq = typeof t.requiredFields === 'string' ? JSON.parse(t.requiredFields) : t.requiredFields;
        setDataJson(JSON.stringify({ ...DEFAULT_DATA, ...rq }, null, 2));
      }
    } catch (e: any) {
      setError(e.message || "Errore di rete");
    } finally { setLoading(false); }
  };

  const compile = useCallback(async () => {
    if (!template || compiling) return;
    setCompiling(true);
    setCompileResult(null);
    try {
      let parsedData = {};
      try { parsedData = JSON.parse(dataJson); } catch (e) { /* ignore */ }
      const res = await fetch(`/api/admin/templates/${code}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${user?.token || ''}`,
        },
        body: JSON.stringify({ source, data: parsedData }),
      });
      const data = await res.json();
      const payload = data.data || data;
      if (payload.ok && payload.pdfBase64) {
        // Crea blob URL per iframe
        const bytes = atob(payload.pdfBase64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(blob));
        setCompileResult({ ok: true, durationMs: payload.durationMs || 0 });
      } else {
        setCompileResult({ ok: false, durationMs: payload.durationMs || 0, errors: payload.errors || [] });
        if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
      }
    } catch (e: any) {
      setCompileResult({ ok: false, durationMs: 0, errors: [{ line: 0, column: 0, message: e.message }] });
    } finally {
      setCompiling(false);
    }
  }, [template, source, dataJson, code, user, compiling, pdfUrl]);

  const saveDraft = async () => {
    if (!template || savingDraft) return;
    setSavingDraft(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/admin/templates/${code}/save-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${user?.token || ''}`,
        },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage("Bozza salvata");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(`Errore: ${data.error || 'salvataggio'}`);
      }
    } catch (e: any) {
      setSaveMessage(`Errore: ${e.message}`);
    } finally {
      setSavingDraft(false);
    }
  };

  const promote = async () => {
    if (!template || promoting) return;
    if (!confirm("Promuovere la bozza a sorgente di produzione?\n\nDa questo momento tutti i nuovi documenti generati useranno questa versione.")) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/admin/templates/${code}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${user?.token || ''}`,
        },
        body: '{}',
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage("Promosso a produzione");
        await loadTemplate();
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(`Errore: ${data.error || 'promozione'}`);
      }
    } catch (e: any) {
      setSaveMessage(`Errore: ${e.message}`);
    } finally {
      setPromoting(false);
    }
  };

  // Ctrl+S, Ctrl+Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDraft();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, dataJson]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 size={32} className="animate-spin text-[#1a2744]" />
    </div>;
  }

  if (error || !template) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] gap-4">
      <AlertCircle size={48} className="text-red-500" />
      <p className="text-red-700">{error || "Template non trovato"}</p>
      <Link href="/admin/template" className="text-[#0f3460] hover:underline">← Torna alla lista</Link>
    </div>;
  }

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc]">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Link href="/admin/template" className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-indigo-500" />
          <span className="font-mono text-sm font-semibold text-[#1a2744]">{template.code}</span>
          <span className="text-sm text-gray-500">{template.name}</span>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">v{template.version}</span>
        </div>
        <div className="flex-1" />

        {saveMessage && (
          <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded">
            {saveMessage}
          </span>
        )}

        <button onClick={saveDraft} disabled={savingDraft}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
          <Save size={14} /> {savingDraft ? '…' : 'Salva bozza'}
          <span className="text-xs text-gray-400 ml-1">⌘S</span>
        </button>
        <button onClick={compile} disabled={compiling}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
          {compiling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {compiling ? 'Compilo…' : 'Compila'}
          <span className="text-xs text-white/70 ml-1">⌘↵</span>
        </button>
        <button onClick={promote} disabled={promoting || !source}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
          <Rocket size={14} /> Promuovi
        </button>
      </header>

      {/* Body 3 colonne */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar info */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-10'} bg-white border-r border-gray-200 flex flex-col transition-all overflow-y-auto flex-shrink-0`}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-50 flex items-center justify-center text-gray-500">
            {sidebarOpen ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          {sidebarOpen && (
            <div className="p-4 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Codice</div>
                <div className="font-mono text-xs">{template.code}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Versione</div>
                <div>{template.version}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Lingua</div>
                <div>{template.language}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Pagina</div>
                <div>{template.pageSize} {template.orientation}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Stato</div>
                <div className="flex flex-wrap gap-1">
                  {template.hasSource && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Source OK</span>}
                  {template.hasDraft && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Draft</span>}
                </div>
              </div>
              {template.sourcePromotedAt && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Promosso</div>
                  <div className="text-xs text-gray-500">
                    {new Date(template.sourcePromotedAt).toLocaleString('it-IT')}
                  </div>
                </div>
              )}
              {template.requiredFields && Object.keys(template.requiredFields).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Campi richiesti</div>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {Object.keys(template.requiredFields).slice(0, 20).map(k => (
                      <li key={k} className="font-mono">· {k}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
          <div className="bg-gray-900 text-white text-xs px-3 py-1.5 flex items-center gap-2 flex-shrink-0">
            <Code2 size={12} />
            <span className="font-mono">{template.code}.typ</span>
            <div className="flex-1" />
            <button onClick={() => setDataPanelOpen(!dataPanelOpen)}
              className="text-xs px-2 py-0.5 rounded hover:bg-white/10 flex items-center gap-1">
              {dataPanelOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              data.json
            </button>
          </div>

          {dataPanelOpen && (
            <div className="bg-gray-800 border-b border-gray-700 p-2 flex-shrink-0" style={{ maxHeight: '200px' }}>
              <div className="text-xs text-gray-300 mb-1">Dati di esempio (JSON):</div>
              <textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)}
                className="w-full bg-gray-900 text-gray-100 text-xs font-mono p-2 rounded border border-gray-700 resize-none"
                rows={6} />
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <CodeMirror
              value={source}
              height="100%"
              theme={oneDark}
              extensions={[markdown()]}
              onChange={(value) => setSource(value)}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
              style={{ fontSize: '13px', height: '100%' }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-2 flex-shrink-0 text-xs">
            <FileText size={12} className="text-gray-500" />
            <span className="font-semibold text-gray-700">Preview PDF</span>
            <div className="flex-1" />
            {compileResult && (
              compileResult.ok ? (
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={12} /> {compileResult.durationMs}ms
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-700">
                  <AlertCircle size={12} /> {compileResult.errors?.length || 0} errori
                </span>
              )
            )}
          </div>

          {compileResult && !compileResult.ok && compileResult.errors && (
            <div className="bg-red-50 border-b border-red-200 px-3 py-2 flex-shrink-0 max-h-32 overflow-y-auto">
              <div className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Errori di compilazione
              </div>
              {compileResult.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-700 font-mono">
                  {err.line > 0 && <span className="font-bold">Riga {err.line}:{err.column}</span>} {err.message}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto p-2">
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full bg-white rounded shadow" title="PDF Preview" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <Play size={32} />
                <p>Premi <strong>Compila</strong> per vedere l'anteprima</p>
                <p className="text-xs">(⌘↵ da tastiera)</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
