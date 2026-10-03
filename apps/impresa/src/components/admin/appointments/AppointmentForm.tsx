'use client';

// 03/10/2026 (C1b-agenda-1b): modale nuovo/modifica appuntamento.
// ADDENDUM separazione contesto/condivisione:
//   - Blocco "Pubblico" → name, start, stop, location, description
//     (description va nell'invito .ics: warning visibile).
//   - Blocco "Collegamento interno (non condiviso)" → relation_id, deal_id.
//     Mai serializzati in ICS o link Google.
//   - Box "Contesto V6" nel dettaglio: progetto, deal, DISC (solo UI).
//   - Link Google Calendar: solo text/dates/location/description.

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, AlertCircle, Info, Download, ExternalLink, Link2 } from 'lucide-react';

type Appointment = {
  id: number;
  name: string;
  start: string;
  stop: string;
  location: string;
  description: string;
  relation_id: number | null;
  relation_name: string | null;
  deal_id: number | null;
  deal_name: string | null;
  external_attendees: string;
  attendee_ids: number[];
  attendee_names: string[];
  user_id: number | null;
  user_name: string | null;
};

type UserOpt = { id: number; name: string };
type ProjOpt = { id: number; name: string };
type DealOpt = { id: number; name: string; project_id?: number | null };

interface Props {
  appointment: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

function toLocalIso(dt: string): { date: string; time: string } {
  if (!dt) return { date: '', time: '' };
  const d = new Date(dt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${g}`, time: `${hh}:${mm}` };
}

const DURATIONS = [
  { v: 30, label: '30 min' },
  { v: 60, label: '60 min' },
  { v: 90, label: '90 min' },
  { v: 120, label: '2h' },
];

function buildGoogleUrl(a: {
  name: string; start: string; stop: string; location: string; description: string;
}): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: a.name || '',
    dates: `${fmt(a.start)}/${fmt(a.stop)}`,
    location: a.location || '',
    // ADDENDUM: solo la description condivisa. Mai contesto V6.
    details: a.description || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function AppointmentForm({ appointment, onClose, onSaved }: Props) {
  const isEdit = !!appointment;

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [relationId, setRelationId] = useState<number | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [partnerIds, setPartnerIds] = useState<number[]>([]);
  const [external, setExternal] = useState('');

  const [users, setUsers] = useState<UserOpt[]>([]);
  const [projects, setProjects] = useState<ProjOpt[]>([]);
  const [deals, setDeals] = useState<DealOpt[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Popola dal record esistente
  useEffect(() => {
    if (!appointment) {
      // Nuovo: data di oggi, ora tonda al prossimo quarto
      const now = new Date();
      const { date: dd, time: tt } = toLocalIso(now.toISOString());
      setDate(dd); setTime(tt);
      return;
    }
    setName(appointment.name || '');
    const s = toLocalIso(appointment.start);
    setDate(s.date); setTime(s.time);
    const start = new Date(appointment.start);
    const stop = new Date(appointment.stop);
    const mins = Math.round((stop.getTime() - start.getTime()) / 60000);
    setDuration(DURATIONS.find(d => d.v === mins)?.v ?? 60);
    setLocation(appointment.location || '');
    setDescription(appointment.description || '');
    setRelationId(appointment.relation_id);
    setDealId(appointment.deal_id);
    setPartnerIds(appointment.attendee_ids || []);
    setExternal(appointment.external_attendees || '');
  }, [appointment]);

  // Select: utenti V6, progetti, deal
  useEffect(() => {
    (async () => {
      try {
        const [uR, pR, dR] = await Promise.all([
          fetch('/api/admin/users', { headers: authHeaders() }),
          fetch('/api/admin/partner-projects', { headers: authHeaders() }),
          fetch('/api/admin/deals', { headers: authHeaders() }),
        ]);
        if (uR.ok) {
          const d = await uR.json();
          if (Array.isArray(d.users)) setUsers(d.users.map((u: any) => ({ id: u.id, name: u.name })));
        }
        if (pR.ok) {
          const d = await pR.json();
          const arr = Array.isArray(d) ? d : (d.projects || d.partner_projects || []);
          setProjects(arr.map((p: any) => ({ id: p.id, name: p.name })));
        }
        if (dR.ok) {
          const d = await dR.json();
          const arr = Array.isArray(d) ? d : (d.deals || []);
          setDeals(arr.map((x: any) => ({ id: x.id, name: x.name, project_id: x.project_id ?? x.relation_id ?? null })));
        }
      } catch { /* silenzioso */ }
    })();
  }, []);

  const dealsFiltered = useMemo(() => {
    if (!relationId) return deals;
    return deals.filter(d => d.project_id == null || d.project_id === relationId);
  }, [deals, relationId]);

  const startIso = useMemo(() => {
    if (!date || !time) return '';
    return `${date}T${time}:00`;
  }, [date, time]);

  const stopIso = useMemo(() => {
    if (!startIso) return '';
    const d = new Date(startIso);
    d.setMinutes(d.getMinutes() + duration);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const g = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${y}-${m}-${g}T${hh}:${mm}:00`;
  }, [startIso, duration]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Il titolo è obbligatorio.'); return; }
    if (!startIso || !stopIso) { setError('Data e ora obbligatorie.'); return; }
    setBusy(true); setError(null);
    try {
      const body: any = {
        name: name.trim(),
        start: startIso,
        stop: stopIso,
        location: location || '',
        description: description || '',
        external_attendees: external || '',
        partner_ids: partnerIds,
        relation_id: relationId || null,
        deal_id: dealId || null,
      };
      const url = isEdit
        ? `/api/admin/appointments/${appointment!.id}`
        : '/api/admin/appointments';
      const method = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Errore salvataggio');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/admin/appointments/${appointment!.id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Errore eliminazione');
      setBusy(false);
    }
  };

  const togglePartner = (id: number) => {
    setPartnerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#0F1E3C]">
            {isEdit ? 'Dettaglio appuntamento' : 'Nuovo appuntamento'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ── Blocco pubblico/condiviso ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Informazioni condivise
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Titolo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0F1E3C]"
                  placeholder="Es. Tavolo commerciale"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ora *</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Durata</label>
                  <select value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    {DURATIONS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Luogo</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Es. Via Roma 1, Mestre / Zoom / Google Meet" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Descrizione
                  <span className="text-amber-600 flex items-center gap-0.5 font-normal">
                    <Info size={11} /> Visibile a tutti i partecipanti nell'invito
                  </span>
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Es. Tavolo su progetto X" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Partecipanti V6 interni
                </label>
                <div className="border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {users.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-1">Nessun utente caricato.</div>
                  ) : users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                      <input type="checkbox" checked={partnerIds.includes(u.id)}
                        onChange={() => togglePartner(u.id)}
                        className="accent-[#0F1E3C]" />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Solo utenti V6 interni. Per invitare esterni usa il file .ics.
                </p>
              </div>
            </div>
          </section>

          {/* ── Blocco interno (non condiviso) ── */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Link2 size={12} /> Collegamento interno (non condiviso)
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">
              Non appare nel file .ics né nel link Google Calendar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Progetto Partner</label>
                <select value={relationId || ''} onChange={e => setRelationId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  <option value="">— Nessuno —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deal</label>
                <select value={dealId || ''} onChange={e => setDealId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  <option value="">— Nessuno —</option>
                  {dealsFiltered.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Contesto V6 (solo se edit + relation/deal) ── */}
          {isEdit && (appointment?.relation_name || appointment?.deal_name) && (
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                Contesto V6 (visibile solo internamente)
              </h3>
              <ul className="text-sm space-y-1">
                {appointment?.relation_id && (
                  <li>
                    <span className="text-gray-500">Progetto Partner: </span>
                    <a href={`/admin/partner-projects/${appointment.relation_id}`} className="text-indigo-700 underline">
                      {appointment.relation_name}
                    </a>
                  </li>
                )}
                {appointment?.deal_id && (
                  <li>
                    <span className="text-gray-500">Deal: </span>
                    <a href={`/admin/deals/${appointment.deal_id}`} className="text-indigo-700 underline">
                      {appointment.deal_name}
                    </a>
                  </li>
                )}
              </ul>
              <p className="text-[11px] text-indigo-600 mt-2">
                Queste informazioni NON vengono mai inviate a partecipanti esterni.
              </p>
            </section>
          )}

          {/* ── Azioni esterne ── */}
          {isEdit && (
            <section className="flex flex-wrap gap-2">
              <a href={`/api/admin/appointments/${appointment!.id}/ics`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">
                <Download size={12} /> Scarica .ics
              </a>
              <a
                href={buildGoogleUrl({
                  name, start: startIso, stop: stopIso,
                  location, description,
                })}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">
                <ExternalLink size={12} /> Condividi su Google Calendar
              </a>
              <a
                href="https://erp.v6sviluppoimpresa.it/web#action=calendar"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">
                <ExternalLink size={12} /> Apri in Odoo Calendar
              </a>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={busy}
                className="text-xs text-red-600 hover:underline disabled:opacity-50">
                Elimina
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
              Annulla
            </button>
            <button onClick={handleSave} disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-[#0F1E3C] text-white hover:bg-[#1a2f54] disabled:opacity-50 flex items-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />}
              Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
