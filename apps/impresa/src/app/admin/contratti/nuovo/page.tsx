"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, FileSignature, AlertCircle, Loader2,
  CheckCircle2, Code2, Users, Building2
} from "lucide-react";

type Template = { id: number; code: string; name: string; category: string | null };
type Project = { id: number; name: string };
type Partner = { id: number; name: string; isCompany: boolean; email: string; vat: string };

export default function NuovoContrattoPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    templateId: 0,
    projectId: 0,
    counterpartyId: 0,
    pdfMode: 'official',
  });

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) { window.location.href = "/login"; return; }
    const u = JSON.parse(session);
    setUser(u);
    loadMeta(u);
  }, []);

  const loadMeta = async (u?: any) => {
    const session = u || user;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contracts/meta', {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Errore'); return; }
      setTemplates(data.templates || []);
      setProjects(data.projects || []);
      setPartners(data.partners || []);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const canGoStep2 = form.templateId > 0 && form.name.trim().length > 0;
  const canGoStep3 = form.projectId > 0 || form.counterpartyId > 0;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${user?.token || ''}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Errore creazione'); setSaving(false); return; }
      router.push(`/admin/contratti/${data.contract.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 size={32} className="animate-spin text-[#1a2744]" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/contratti" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a2744]">Nuovo contratto</h1>
            <p className="text-sm text-gray-500">Passo {step} di 3</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`flex-1 h-2 rounded-full ${n <= step ? 'bg-[#1a2744]' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-6">

          {/* STEP 1: Template + Nome */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Code2 size={18} className="text-indigo-500" />
                <h2 className="text-lg font-semibold text-[#1a2744]">Tipo di documento</h2>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Titolo</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="Es. NDA TEE - Power Ventures"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Template</label>
                <select value={form.templateId}
                  onChange={(e) => setForm({...form, templateId: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value={0}>— scegli template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button disabled={!canGoStep2} onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-40">
                  Avanti <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Progetto + Controparte */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-indigo-500" />
                <h2 className="text-lg font-semibold text-[#1a2744]">Progetto e controparte</h2>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Progetto (opzionale)</label>
                <select value={form.projectId}
                  onChange={(e) => setForm({...form, projectId: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value={0}>— nessun progetto —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Da qui vengono pescati dati, parti, base compenso</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Controparte (opzionale)</label>
                <select value={form.counterpartyId}
                  onChange={(e) => setForm({...form, counterpartyId: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value={0}>— nessuna controparte —</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.isCompany ? '🏢 ' : '👤 '}{p.name}{p.vat ? ` · ${p.vat}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Chi firma insieme a V6 (o destinatario)</p>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                  <ArrowLeft size={16} /> Indietro
                </button>
                <button disabled={!canGoStep3} onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-40">
                  Avanti <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PDF mode + Conferma */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileSignature size={18} className="text-indigo-500" />
                <h2 className="text-lg font-semibold text-[#1a2744]">Conferma e crea</h2>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Titolo:</span>
                  <span className="font-medium">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Template:</span>
                  <span className="font-mono text-xs">{templates.find(t => t.id === form.templateId)?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Progetto:</span>
                  <span>{projects.find(p => p.id === form.projectId)?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Controparte:</span>
                  <span>{partners.find(p => p.id === form.counterpartyId)?.name || '—'}</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" checked={form.pdfMode === 'preview'}
                    onChange={() => setForm({...form, pdfMode: 'preview'})}
                    className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Anteprima (filigrana)</div>
                    <div className="text-xs text-gray-500">PDF con scritta ANTEPRIMA diagonale. NON inviabile per firma.</div>
                  </div>
                </label>
              </div>

              <div className="border border-gray-200 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" checked={form.pdfMode === 'official'}
                    onChange={() => setForm({...form, pdfMode: 'official'})}
                    className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Ufficiale</div>
                    <div className="text-xs text-gray-500">PDF senza filigrana. Invio per firma consentito (se non ci sono placeholder).</div>
                  </div>
                </label>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                  <ArrowLeft size={16} /> Indietro
                </button>
                <button disabled={saving} onClick={submit}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Creo…' : 'Crea contratto'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
