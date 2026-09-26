"use client";
import { useEffect, useRef, useState } from "react";
import { X, Send, Paperclip, Loader2, Trash2, Search } from "lucide-react";

type Partner = { id: number; name: string; email: string; isCompany: boolean };
type Project = { id: number; name: string; emailAlias: string };
type Attachment = { id: number; name: string; size: number };

interface Props {
  open: boolean;
  onClose: () => void;
  user: any;
  initialTo?: string;
  initialCc?: string;
  initialSubject?: string;
  initialBody?: string;
  onSent?: () => void;
}

export default function ComposerModal({
  open, onClose, user,
  initialTo = '', initialCc = '', initialSubject = '', initialBody = '',
  onSent,
}: Props) {
  const [toList, setToList] = useState<string[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [projectId, setProjectId] = useState<number>(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Partner[]>([]);
  const [suggestFor, setSuggestFor] = useState<'to' | 'cc' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Init dai valori passati
    setToList(initialTo ? initialTo.split(',').map(s => s.trim()).filter(Boolean) : []);
    setCcList(initialCc ? initialCc.split(',').map(s => s.trim()).filter(Boolean) : []);
    setSubject(initialSubject);
    setBody(initialBody);
    setAttachments([]);
    setProjectId(0);
    setMsg(null);
    // Carica progetti
    fetch('/api/admin/emails/search-projects', {
      headers: { Authorization: `JWT ${user?.token || ''}` },
    }).then(r => r.json()).then(d => {
      const p = d.data || d;
      if (p.success) setProjects(p.projects || []);
    }).catch(() => {});
  }, [open, initialTo, initialCc, initialSubject, initialBody, user]);

  const searchPartners = async (q: string, target: 'to' | 'cc') => {
    if (q.length < 2) { setSuggestions([]); setSuggestFor(null); return; }
    try {
      const r = await fetch(`/api/admin/emails/search-partners?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `JWT ${user?.token || ''}` },
      });
      const d = await r.json();
      const p = d.data || d;
      if (p.success) {
        setSuggestions(p.partners || []);
        setSuggestFor(target);
      }
    } catch {}
  };

  const addRecipient = (target: 'to' | 'cc', value: string) => {
    const v = value.trim();
    if (!v) return;
    if (target === 'to') {
      if (!toList.includes(v)) setToList([...toList, v]);
      setToInput('');
    } else {
      if (!ccList.includes(v)) setCcList([...ccList, v]);
      setCcInput('');
    }
    setSuggestions([]); setSuggestFor(null);
  };

  const removeRecipient = (target: 'to' | 'cc', value: string) => {
    if (target === 'to') setToList(toList.filter(x => x !== value));
    else setCcList(ccList.filter(x => x !== value));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) { setMsg('File > 10 MB'); return; }
    setBusy(true); setMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      const r = await fetch('/api/admin/emails/upload', {
        method: 'POST',
        headers: { Authorization: `JWT ${user?.token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, content: b64 }),
      });
      const d = await r.json();
      const p = d.data || d;
      if (!p.success) { setMsg('Errore upload: ' + (p.error || '?')); return; }
      setAttachments([...attachments, { id: p.attachmentId, name: p.name, size: p.size }]);
    } catch (e: any) { setMsg('Errore: ' + e.message); }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const send = async () => {
    if (toList.length === 0 || !subject.trim()) {
      setMsg('Destinatario e oggetto obbligatori');
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: { Authorization: `JWT ${user?.token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          subject,
          body,
          attachmentIds: attachments.map(a => a.id),
          projectId: projectId || null,
        }),
      });
      const d = await r.json();
      const p = d.data || d;
      if (!p.success) { setMsg('Errore: ' + (p.error || 'invio fallito')); return; }
      setMsg(`✓ Email inviata da ${p.from}`);
      setTimeout(() => { onClose(); onSent?.(); }, 1500);
    } catch (e: any) { setMsg('Errore: ' + e.message); }
    finally { setBusy(false); }
  };

  if (!open) return null;

  const RecipientChips = ({ list, input, target, placeholder }: any) => (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1.5 border border-gray-200 rounded text-sm bg-white min-h-[36px]">
        {list.map((v: string) => (
          <span key={v} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
            {v}
            <button onClick={() => removeRecipient(target, v)} className="hover:text-red-600">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            if (target === 'to') setToInput(v); else setCcInput(v);
            searchPartners(v, target);
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              e.preventDefault();
              addRecipient(target, input);
            } else if (e.key === 'Backspace' && !input && list.length > 0) {
              removeRecipient(target, list[list.length - 1]);
            }
          }}
          placeholder={list.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-xs bg-transparent"
        />
      </div>
      {suggestFor === target && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto">
          {suggestions.map(p => (
            <button
              key={p.id}
              onClick={() => addRecipient(target, p.email)}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-xs border-b border-gray-50 last:border-0"
            >
              <span className="font-medium">{p.isCompany ? '🏢 ' : '👤 '}{p.name}</span>
              <span className="text-gray-500 ml-2">{p.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-[#1a2744] text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
          <h3 className="text-sm font-bold">Nuovo messaggio</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">A *</label>
            <RecipientChips list={toList} input={toInput} target="to" placeholder="nome@esempio.it (invio per aggiungere)" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CC</label>
            <RecipientChips list={ccList} input={ccInput} target="cc" placeholder="(opzionale)" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Oggetto *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Progetto (opzionale)</label>
            <select value={projectId} onChange={e => setProjectId(parseInt(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm">
              <option value={0}>— nessun progetto collegato —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.emailAlias ? ` (${p.emailAlias})` : ''}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">From diverrà <code>slug+progetto@v6impresa.it</code> e il log verrà taggato col progetto.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Messaggio</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-y" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-gray-600">Allegati</label>
              <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50">
                <Paperclip size={12} /> Allega
              </button>
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => handleUpload(e.target.files)} />
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                    <Paperclip size={11} className="text-gray-500" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-gray-400">{(a.size / 1024).toFixed(1)} KB</span>
                    <button onClick={() => setAttachments(attachments.filter(x => x.id !== a.id))}
                      className="text-red-500 hover:text-red-700">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {msg && (
            <div className={`text-xs p-2 rounded ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {msg}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100">
            Annulla
          </button>
          <button onClick={send} disabled={busy || toList.length === 0 || !subject.trim()}
            className="px-4 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium hover:bg-[#0f3460] disabled:opacity-40 flex items-center gap-1.5">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {busy ? 'Invio…' : 'Invia'}
          </button>
        </div>
      </div>
    </div>
  );
}
