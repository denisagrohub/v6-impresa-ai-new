'use client';

// 03/10/2026 (C1b-agenda-1b): /admin/appointments — lista settimanale.
// - Vista 7 giorni verticali (lun→dom) con eventi compatti.
// - Navigazione settimana (prec/questa/succ).
// - Click su evento → apre AppointmentForm in modal (dettaglio).
// - "+ Nuovo" → apre AppointmentForm in modal (creazione).
// - ADDENDUM: description è condivisa. Il contesto V6 (progetto,
//   deal, DISC) è solo nel modal, mai in ICS o link Google.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle, Clock } from 'lucide-react';
import AppointmentForm from './AppointmentForm';

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
  telegram_reminder_sent_at: string | null;
  partner_ids: number[];
  attendee_ids: number[];
  attendee_names: string[];
  user_id: number | null;
  user_name: string | null;
  is_v6: boolean;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

// Lunedì della settimana corrente + offset settimane
function mondayOf(offsetWeeks: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Lun=0 ... Dom=6
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  return d;
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}
const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const MONTHS_SHORT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

function fmtRange(monday: Date): string {
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const m1 = MONTHS_SHORT[monday.getMonth()];
  const m2 = MONTHS_SHORT[sunday.getMonth()];
  const y = sunday.getFullYear();
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} - ${sunday.getDate()} ${m1} ${y}`;
  }
  return `${monday.getDate()} ${m1} - ${sunday.getDate()} ${m2} ${y}`;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function AppointmentsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset]);
  const sunday = useMemo(() => { const d = new Date(monday); d.setDate(monday.getDate() + 6); return d; }, [monday]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(
        `/api/admin/appointments?scope=all&from=${toISO(monday)}&to=${toISO(sunday)}`,
        { headers: authHeaders() }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setAppointments(d.appointments || []);
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekOffset]);

  // Raggruppa per giorno (index 0=lun ... 6=dom)
  const byDay = useMemo(() => {
    const groups: Appointment[][] = Array.from({ length: 7 }, () => []);
    for (const a of appointments) {
      const d = new Date(a.start);
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      groups[idx].push(a);
    }
    for (const g of groups) g.sort((x, y) => x.start.localeCompare(y.start));
    return groups;
  }, [appointments]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F1E3C]">Appuntamenti</h1>
            <p className="text-sm text-gray-500 mt-1">
              Vista settimanale · {appointments.length} eventi
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F1E3C] text-white text-sm font-medium hover:bg-[#1a2f54]"
          >
            <Plus size={16} /> Nuovo appuntamento
          </button>
        </div>

        {/* Navigazione settimana */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50">
            Questa settimana
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-semibold text-[#0F1E3C]">{fmtRange(monday)}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
            <button onClick={load} className="ml-auto underline font-medium">Riprova</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 size={16} className="animate-spin" /> Caricamento…
          </div>
        )}

        {/* Empty */}
        {!loading && !error && appointments.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
            <Clock size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nessun appuntamento questa settimana.</p>
          </div>
        )}

        {/* 7 giorni */}
        {!loading && appointments.length > 0 && (
          <div className="space-y-3">
            {byDay.map((events, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i);
              const isToday = toISO(d) === toISO(new Date());
              return (
                <div key={i} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                  <div className={`px-4 py-2 flex items-center gap-2 ${isToday ? 'bg-[#0F1E3C] text-white' : 'bg-gray-50 text-[#0F1E3C]'}`}>
                    <span className="font-semibold text-sm">{DAY_NAMES[i]}</span>
                    <span className="text-xs opacity-70">{d.getDate()} {MONTHS_SHORT[d.getMonth()]}</span>
                    {events.length > 0 && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20' : 'bg-gray-200 text-gray-700'}`}>
                        {events.length}
                      </span>
                    )}
                  </div>
                  {events.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">Nessun evento</div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {events.map(ev => (
                        <li key={ev.id}>
                          <button
                            onClick={() => { setEditing(ev); setFormOpen(true); }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                          >
                            <span className="text-xs font-mono text-gray-500 w-24 shrink-0">
                              {fmtTime(ev.start)} – {fmtTime(ev.stop)}
                            </span>
                            <span className="flex-1">
                              <span className="font-medium text-sm text-[#0F1E3C] block">{ev.name}</span>
                              {ev.location && (
                                <span className="text-xs text-gray-500 block mt-0.5">{ev.location}</span>
                              )}
                              {(ev.relation_name || ev.deal_name) && (
                                <span className="text-xs text-gray-400 block mt-0.5">
                                  {[ev.relation_name, ev.deal_name].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <AppointmentForm
          appointment={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
