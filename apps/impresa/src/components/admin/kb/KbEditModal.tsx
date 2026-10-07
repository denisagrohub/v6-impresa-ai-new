'use client';

// 07/10/2026 (C-kb-3c): modale editor KB (modifica + creazione).
// Sicurezza: richiede sessione OTP 'write' (modifica) o 'critical'
// (creazione). Se manca, il parent apre OtpVerifyModal e poi richiama.

import { useState } from 'react';
import { X, Loader2, AlertCircle, Save, FileText } from 'lucide-react';
import { kbSessionHeader, type KbPurpose } from '@/lib/kb-session';

export type KbEditPayload = {
  id?: number;
  name: string;
  kb_type: string;
  category_id: number | null;
  description: string;
  content: string;
  access_level: string;
};

type Props = {
  mode: 'create' | 'edit';
  initial?: Partial<KbEditPayload>;
  onSaved: (id: number) => void;
  onCancel: () => void;
  onNeedOtp: (purpose: KbPurpose) => void;
};

const KB_TYPE_OPTIONS = [
  { code: 'fiscale', label: 'Fiscale' },
  { code: 'psicologico', label: 'Psicologico' },
  { code: 'normativo', label: 'Normativo' },
  { code: 'industriale', label: 'Industriale' },
  { code: 'artigianale', label: 'Artigianale' },
  { code: 'prompt', label: 'Prompt AI' },
  { code: 'metodo_v6', label: 'Metodo V6' },
  { code: 'changelog_tecnico', label: 'Changelog Tecnico' },
  { code: 'colori', label: 'Colori' },
  { code: 'disc_assessment', label: 'DISC Assessment' },
];

const ACCESS_OPTIONS = [
  { code: 'public', label: 'Pubblico' },
  { code: 'consultant', label: 'Consulenti' },
  { code: 'ai_only', label: 'Solo AI' },
  { code: 'admin', label: 'Solo Admin' },
];

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function KbEditModal({
  mode,
  initial,
  onSaved,
  onCancel,
  onNeedOtp,
}: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [kbType, setKbType] = useState(initial?.kb_type || 'fiscale');
  const [categoryId, setCategoryId] = useState<string>(
    initial?.category_id ? String(initial.category_id) : '',
  );
  const [description, setDescription] = useState(initial?.description || '');
  const [content, setContent] = useState(initial?.content || '');
  const [accessLevel, setAccessLevel] = useState(initial?.access_level || 'consultant');
  const [changeNotes, setChangeNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const purpose: KbPurpose = mode === 'create' ? 'critical' : 'write';

  async function save() {
    if (!name.trim()) {
      setError('Il titolo è obbligatorio');
      return;
    }
    if (!content.trim()) {
      setError('Il contenuto è obbligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Verifica sessione corretta PRIMA di inviare
      const headers: Record<string, string> = {
        ...authHeaders(),
        ...kbSessionHeader(purpose),
      };
      if (!headers['X-Kb-Session']) {
        // Nessuna sessione: chiedi OTP e ritorna
        setSaving(false);
        onNeedOtp(purpose);
        return;
      }

      const payload: any = {
        name: name.trim(),
        kb_type: kbType,
        description: description.trim(),
        content,
        access_level: accessLevel,
      };
      if (categoryId) {
        try { payload.category_id = parseInt(categoryId, 10); } catch {}
      }
      if (mode === 'edit' && changeNotes.trim()) {
        payload.change_notes = changeNotes.trim();
      }

      const url = mode === 'create'
        ? '/api/kb/articles'
        : `/api/kb/articles/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const r = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      const body = d.data || d;

      // 401 => sessione scaduta -> richiedi nuovo OTP
      if (r.status === 401 && typeof body?.error === 'string'
          && body.error.startsWith('kb_session_')) {
        setSaving(false);
        onNeedOtp(purpose);
        return;
      }
      if (!r.ok || body?.error) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      onSaved(body.id || initial?.id);
    } catch (e: any) {
      setError(e.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200">
          <FileText className="w-5 h-5 text-slate-700" />
          <h2 className="text-sm font-semibold text-[#0F1E3C]">
            {mode === 'create' ? 'Nuova KB' : 'Modifica KB'}
          </h2>
          <div className="ml-auto text-xs text-slate-500">
            OTP richiesto: <span className="font-mono">{purpose}</span>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Titolo *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded outline-none focus:border-slate-500"
              placeholder="Titolo KB"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                value={kbType}
                onChange={(e) => setKbType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded bg-white"
              >
                {KB_TYPE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Categoria ID</label>
              <input
                type="number"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                placeholder="opzionale"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Accesso</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded bg-white"
              >
                {ACCESS_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Abstract</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              placeholder="Breve descrizione"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Contenuto * <span className="text-slate-400">(markdown)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded font-mono resize-y"
              placeholder="# Titolo&#10;Testo in markdown..."
            />
          </div>

          {mode === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Note modifica <span className="text-slate-400">(opzionale)</span>
              </label>
              <input
                type="text"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                placeholder="Cosa hai cambiato?"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-white"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || !content.trim()}
            className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Crea' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
