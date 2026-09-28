'use client';

import { useState } from 'react';
import { Calendar, FileText, Lock, Send, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';

export type SettlementLine = {
  id: number;
  partnerName: string;
  tier: string;
  sharePct: number;
  importoEffettivo: number;
  visibility: 'self' | 'full';
  causaleFattura: string;
  sentAt: string | null;
  paid: boolean;
  paidAt: string | null;
  // 28/09/2026: pagamento
  pagamentoStato: 'attesa_fattura' | 'fattura_ricevuta' | 'in_pagamento' | 'pagato' | 'contestato';
  fatturaRicevutaIl: string | null;
  fatturaScadenza: string | null;
  giorniRitardo: number;
  contestatoMotivo: string;
  notePagamento: string;
  pagabile: boolean;
  importoSbloccato: number;
};

export type Incasso = {
  id: number;
  data: string;
  importo: number;
  riferimento: string;
  source: string;
  matchedAuto: boolean;
  note: string;
};

export type Settlement = {
  id: number;
  name: string;
  dealId: number;
  periodoMese: string;
  periodoAnno: number;
  state: 'draft' | 'frozen' | 'sent' | 'signed' | 'closed';
  quantitaReale: number;
  prezzoMedioReale: number;
  feePctReale: number;
  unita: string;
  transatoTotale: number;
  ricavoLordo: number;
  nettoRipartizione: number;
  transparencyUnlocked: boolean;
  noteMensili: string;
  lineCount: number;
  lines?: SettlementLine[];
  // 28/09/2026: incasso upstream
  incassoModalita: 'totale' | 'proporzionale';
  incassoImporto: number;
  incassoStato: 'attesa' | 'parziale' | 'totale';
  incassoPercentuale: number;
  incassi?: Incasso[];
};

const MESI = [
  { v: '1', l: 'Gennaio' }, { v: '2', l: 'Febbraio' }, { v: '3', l: 'Marzo' },
  { v: '4', l: 'Aprile' }, { v: '5', l: 'Maggio' }, { v: '6', l: 'Giugno' },
  { v: '7', l: 'Luglio' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Settembre' },
  { v: '10', l: 'Ottobre' }, { v: '11', l: 'Novembre' }, { v: '12', l: 'Dicembre' },
];

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

const STATE_STYLE: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-700 border-gray-300',
  frozen: 'bg-amber-50 text-amber-800 border-amber-300',
  sent: 'bg-blue-50 text-blue-700 border-blue-300',
  signed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

const STATE_LABEL: Record<string, string> = {
  draft: 'Bozza',
  frozen: 'Congelato',
  sent: 'In firma',
  signed: 'Firmato',
  closed: 'Chiuso',
};

const PAGAMENTO_STYLE: Record<string, string> = {
  attesa_fattura: 'bg-gray-100 text-gray-700 border-gray-300',
  fattura_ricevuta: 'bg-blue-50 text-blue-700 border-blue-300',
  in_pagamento: 'bg-amber-50 text-amber-800 border-amber-300',
  pagato: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  contestato: 'bg-red-50 text-red-700 border-red-300',
};

const PAGAMENTO_LABEL: Record<string, string> = {
  attesa_fattura: 'Attesa fattura',
  fattura_ricevuta: 'Fattura ricevuta',
  in_pagamento: 'In pagamento',
  pagato: 'Pagato',
  contestato: 'Contestato',
};

const INCASSO_STYLE: Record<string, string> = {
  attesa: 'bg-red-50 text-red-700 border-red-300',
  parziale: 'bg-amber-50 text-amber-800 border-amber-300',
  totale: 'bg-emerald-50 text-emerald-700 border-emerald-300',
};

const INCASSO_LABEL: Record<string, string> = {
  attesa: 'In attesa incasso',
  parziale: 'Incasso parziale',
  totale: 'Incassato',
};

export function SettlementsPanel({
  dealId,
  settlements,
  onRefresh,
  authToken,
}: {
  dealId: number;
  settlements: Settlement[];
  onRefresh: () => void;
  authToken: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    periodo_mese: String(new Date().getMonth() + 1),
    periodo_anno: new Date().getFullYear(),
    quantita_reale: 0,
    prezzo_medio_reale: 0,
    fee_pct_reale: 0,
    unita: 'TEE',
    note_mensili: '',
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showFrozen, setShowFrozen] = useState(false);

  const authHeader = { Authorization: `JWT ${authToken}` };

  const handleCreate = async () => {
    setBusy('create');
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/deals/${dealId}/settlements`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else {
        setMsg(`✓ Consuntivo creato`);
        setShowForm(false);
        onRefresh();
      }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  const handleFreeze = async (id: number) => {
    setBusy(`freeze-${id}`);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/settlements/${id}/freeze`, {
        method: 'POST',
        headers: authHeader,
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else { setMsg('✓ Consuntivo congelato + PDF generato'); onRefresh(); }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  const [incassoForm, setIncassoForm] = useState<{ open: boolean; settlementId: number | null; importo: number; riferimento: string; note: string }>({
    open: false, settlementId: null, importo: 0, riferimento: '', note: '',
  });

  const handleRegistraIncasso = async () => {
    if (!incassoForm.settlementId || incassoForm.importo <= 0) return;
    setBusy('incasso');
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/settlements/${incassoForm.settlementId}/incasso`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importo: incassoForm.importo,
          riferimento: incassoForm.riferimento,
          note: incassoForm.note,
        }),
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else {
        setMsg(`✓ Incasso registrato`);
        setIncassoForm({ open: false, settlementId: null, importo: 0, riferimento: '', note: '' });
        onRefresh();
      }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  const handleDeleteIncasso = async (incassoId: number) => {
    if (!window.confirm('Eliminare questo movimento incasso?')) return;
    setBusy(`del-incasso-${incassoId}`);
    try {
      const r = await fetch(`/api/admin/settlements/incassi/${incassoId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else { setMsg('✓ Movimento eliminato'); onRefresh(); }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  const handlePagamento = async (lineId: number, action: string, motivo?: string) => {
    setBusy(`pay-${lineId}`);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/settlements/lines/${lineId}/pagamento`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, motivo }),
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else { setMsg(`✓ Stato aggiornato: ${PAGAMENTO_LABEL[d.line.pagamentoStato] || d.line.pagamentoStato}`); onRefresh(); }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  const handleSendToSign = async (id: number) => {
    setBusy(`sign-${id}`);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/settlements/${id}/send-to-sign`, {
        method: 'POST',
        headers: authHeader,
      });
      const d = await r.json();
      if (d.error) setMsg(`Errore: ${d.error}`);
      else { setMsg(`✓ Inviato in firma (${d.signRequestIds?.length || 0} richieste)`); onRefresh(); }
    } catch (e: any) { setMsg(`Errore: ${e.message}`); }
    finally { setBusy(null); }
  };

  return (
    <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Calendar size={16} className="text-indigo-600" />
          Consuntivi mensili
          {!showFrozen && settlements.filter(s => ['draft','frozen','closed'].includes(s.state)).length > 0 && (
            <span className="text-xs font-normal text-gray-400">
              ({settlements.filter(s => ['draft','frozen','closed'].includes(s.state)).length} nascosti)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFrozen(!showFrozen)}
            className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
          >
            {showFrozen ? 'Solo attivi' : 'Mostra tutti'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            {showForm ? 'Annulla' : '+ Nuovo consuntivo'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-3 text-xs p-2 rounded ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      {showForm && (
        <div className="mb-4 p-3 border border-indigo-200 rounded bg-indigo-50/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              id="settlement-periodo-mese"
              name="periodo_mese"
              value={form.periodo_mese}
              onChange={(e) => setForm({ ...form, periodo_mese: e.target.value })}
              className="px-2 py-1.5 rounded border text-xs"
            >
              {MESI.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <input
              id="settlement-periodo-anno"
              name="periodo_anno"
              type="number"
              value={form.periodo_anno}
              onChange={(e) => setForm({ ...form, periodo_anno: parseInt(e.target.value || '0') })}
              className="px-2 py-1.5 rounded border text-xs"
              placeholder="Anno"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              id="settlement-quantita"
              name="quantita_reale"
              type="number" step="0.01"
              value={form.quantita_reale}
              onChange={(e) => setForm({ ...form, quantita_reale: parseFloat(e.target.value || '0') })}
              className="px-2 py-1.5 rounded border text-xs"
              placeholder="Quantità"
            />
            <input
              id="settlement-prezzo"
              name="prezzo_medio_reale"
              type="number" step="0.01"
              value={form.prezzo_medio_reale}
              onChange={(e) => setForm({ ...form, prezzo_medio_reale: parseFloat(e.target.value || '0') })}
              className="px-2 py-1.5 rounded border text-xs"
              placeholder="Prezzo medio"
            />
            <input
              id="settlement-fee"
              name="fee_pct_reale"
              type="number" step="0.1"
              value={form.fee_pct_reale}
              onChange={(e) => setForm({ ...form, fee_pct_reale: parseFloat(e.target.value || '0') })}
              className="px-2 py-1.5 rounded border text-xs"
              placeholder="Fee %"
            />
          </div>
          <input
            id="settlement-unita"
            name="unita"
            value={form.unita}
            onChange={(e) => setForm({ ...form, unita: e.target.value })}
            className="w-full px-2 py-1.5 rounded border text-xs"
            placeholder="Unità (TEE, MWh, ...)"
          />
          <textarea
            id="settlement-note"
            name="note_mensili"
            value={form.note_mensili}
            onChange={(e) => setForm({ ...form, note_mensili: e.target.value })}
            rows={2}
            className="w-full px-2 py-1.5 rounded border text-xs"
            placeholder="Note mensili (opzionale)"
          />
          <button
            onClick={handleCreate}
            disabled={busy === 'create'}
            className="w-full py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === 'create' ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
            Crea consuntivo
          </button>
        </div>
      )}

      {settlements.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Nessun consuntivo. Creane uno per iniziare.</p>
      ) : (
        <div className="space-y-2">
          {(showFrozen
            ? settlements
            : settlements.filter(s => !['draft', 'frozen', 'closed'].includes(s.state))
          ).map((s) => {
            const isExp = expanded === s.id;
            const st = STATE_STYLE[s.state] || STATE_STYLE.draft;
            return (
              <div key={s.id} className={`rounded-lg border p-3 ${st}`}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => setExpanded(isExp ? null : s.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span className="font-semibold text-sm">
                        {MESI.find(m => m.v === s.periodoMese)?.l} {s.periodoAnno}
                      </span>
                      <span className="text-xs rounded-full border border-current px-2 py-0.5">
                        {STATE_LABEL[s.state] || s.state}
                      </span>
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {s.quantitaReale.toLocaleString('it-IT')} {s.unita} @ {s.prezzoMedioReale.toLocaleString('it-IT')} EUR → fee {eur(s.ricavoLordo)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.state === 'draft' && (
                      <button
                        onClick={() => handleFreeze(s.id)}
                        disabled={busy === `freeze-${s.id}`}
                        className="px-2 py-1 rounded border border-amber-400 text-[11px] font-semibold hover:bg-white"
                      >
                        {busy === `freeze-${s.id}` ? <Loader2 size={11} className="inline animate-spin" /> : <Lock size={11} className="inline mr-1" />}
                        Congela
                      </button>
                    )}
                    {s.state === 'frozen' && (
                      <button
                        onClick={() => handleSendToSign(s.id)}
                        disabled={busy === `sign-${s.id}`}
                        className="px-2 py-1 rounded border border-indigo-400 text-[11px] font-semibold hover:bg-white"
                      >
                        {busy === `sign-${s.id}` ? <Loader2 size={11} className="inline animate-spin" /> : <Send size={11} className="inline mr-1" />}
                        Invia in firma
                      </button>
                    )}
                  </div>
                </div>

                {isExp && (
                  <div className="mt-3 pt-3 border-t border-current/20">
                    {/* 28/09/2026: banner incasso upstream */}
                    <div className={`mb-3 rounded-lg border p-2 flex items-center justify-between gap-2 ${INCASSO_STYLE[s.incassoStato] || INCASSO_STYLE.attesa}`}>
                      <div className="text-xs">
                        <div className="font-semibold">
                          {INCASSO_LABEL[s.incassoStato] || s.incassoStato}
                          {' · '}
                          € {s.incassoImporto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          {' ('}
                          {s.incassoPercentuale.toFixed(1)}%
                          {')'}
                        </div>
                        <div className="text-[10px] opacity-70">
                          Modalità: {s.incassoModalita === 'totale' ? 'Totale' : 'Proporzionale'}
                        </div>
                      </div>
                      <button
                        onClick={() => setIncassoForm({ open: true, settlementId: s.id, importo: 0, riferimento: '', note: '' })}
                        className="px-2 py-1 rounded border border-current text-[10px] font-semibold hover:bg-white/50"
                      >
                        + Registra incasso
                      </button>
                    </div>

                    {/* Form incasso inline */}
                    {incassoForm.open && incassoForm.settlementId === s.id && (
                      <div className="mb-3 p-2 border border-indigo-200 rounded bg-indigo-50/40 space-y-1.5 text-xs">
                        <input
                          id="incasso-importo"
                          name="importo"
                          type="number" step="0.01" placeholder="Importo €"
                          value={incassoForm.importo || ''}
                          onChange={e => setIncassoForm({...incassoForm, importo: parseFloat(e.target.value || '0')})}
                          className="w-full px-2 py-1 rounded border text-xs"
                        />
                        <input
                          id="incasso-riferimento"
                          name="riferimento"
                          type="text" placeholder="Riferimento (CRO / bonifico)"
                          value={incassoForm.riferimento}
                          onChange={e => setIncassoForm({...incassoForm, riferimento: e.target.value})}
                          className="w-full px-2 py-1 rounded border text-xs"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setIncassoForm({ open: false, settlementId: null, importo: 0, riferimento: '', note: '' })}
                            className="px-2 py-0.5 rounded border border-gray-300 text-[10px]"
                          >
                            Annulla
                          </button>
                          <button
                            onClick={handleRegistraIncasso}
                            disabled={busy === 'incasso' || incassoForm.importo <= 0}
                            className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold disabled:opacity-40"
                          >
                            {busy === 'incasso' ? 'Salvo…' : 'Registra'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lista movimenti incasso */}
                    {s.incassi && s.incassi.length > 0 && (
                      <div className="mb-3 text-[10px]">
                        <div className="font-semibold opacity-70 mb-1">Movimenti incasso ({s.incassi.length})</div>
                        {s.incassi.map(i => (
                          <div key={i.id} className="flex items-center justify-between gap-2 py-0.5 border-b border-current/10">
                            <span>
                              {new Date(i.data).toLocaleDateString('it-IT')}
                              {' · '}
                              € {i.importo.toLocaleString('it-IT', {minimumFractionDigits: 2})}
                              {i.riferimento && ` · ${i.riferimento}`}
                            </span>
                            <button
                              onClick={() => handleDeleteIncasso(i.id)}
                              disabled={busy === `del-incasso-${i.id}`}
                              className="text-red-500 hover:text-red-700 disabled:opacity-40"
                              title="Elimina"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isExp && s.lines && (
                  <div className="mt-3 pt-3 border-t border-current/20 text-xs">
                    <div className="grid grid-cols-4 gap-2 font-semibold mb-2">
                      <div>Partner</div>
                      <div>Tier</div>
                      <div className="text-right">Quota</div>
                      <div className="text-right">Importo</div>
                    </div>
                    {s.lines.map((l) => {
                      const pstyle = PAGAMENTO_STYLE[l.pagamentoStato] || PAGAMENTO_STYLE.attesa_fattura;
                      const plabel = PAGAMENTO_LABEL[l.pagamentoStato] || l.pagamentoStato;
                      const isRitardo = (l.giorniRitardo || 0) > 0;
                      return (
                        <div key={l.id} className="py-2 border-t border-current/10">
                          <div className="grid grid-cols-4 gap-2 items-center">
                            <div className="font-medium">{l.partnerName}</div>
                            <div className="opacity-70">{l.tier}</div>
                            <div className="text-right font-mono">{l.sharePct.toFixed(2)}%</div>
                            <div className="text-right font-mono">{eur(l.importoEffettivo)}</div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pstyle}`}>
                                {plabel}
                                {isRitardo && <span className="ml-1 text-red-700">+{l.giorniRitardo}gg</span>}
                              </span>
                              {!l.pagabile && (
                                <span className="text-[10px] text-red-600 italic">
                                  ⚠ Bloccato: attendere incasso cliente
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {l.pagamentoStato === 'attesa_fattura' && (
                                <button
                                  onClick={() => handlePagamento(l.id, 'fattura_ricevuta')}
                                  disabled={busy === `pay-${l.id}` || l.pagabile !== true}
                                  title={!l.pagabile ? 'Attendi incasso dal cliente' : ''}
                                  className="px-2 py-0.5 rounded border border-blue-400 text-[10px] font-semibold hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Fattura ricevuta
                                </button>
                              )}
                              {l.pagamentoStato === 'fattura_ricevuta' && (
                                <>
                                  <button
                                    onClick={() => handlePagamento(l.id, 'in_pagamento')}
                                    disabled={busy === `pay-${l.id}`}
                                    className="px-2 py-0.5 rounded border border-amber-400 text-[10px] font-semibold hover:bg-amber-50"
                                  >
                                    Autorizza
                                  </button>
                                  <button
                                    onClick={() => {
                                      const m = window.prompt('Motivo contestazione?');
                                      if (m) handlePagamento(l.id, 'contestato', m);
                                    }}
                                    disabled={busy === `pay-${l.id}`}
                                    className="px-2 py-0.5 rounded border border-red-300 text-[10px] text-red-700 hover:bg-red-50"
                                  >
                                    Contesta
                                  </button>
                                </>
                              )}
                              {l.pagamentoStato === 'in_pagamento' && (
                                <button
                                  onClick={() => handlePagamento(l.id, 'pagato')}
                                  disabled={busy === `pay-${l.id}`}
                                  className="px-2 py-0.5 rounded border border-emerald-400 text-[10px] font-semibold hover:bg-emerald-50"
                                >
                                  Segna pagato
                                </button>
                              )}
                            </div>
                          </div>
                          {l.fatturaScadenza && (
                            <div className="mt-1 text-[10px] opacity-60">
                              Fattura ricevuta: {l.fatturaRicevutaIl ? new Date(l.fatturaRicevutaIl).toLocaleDateString('it-IT') : '—'}
                              {' · '}
                              Scadenza: {new Date(l.fatturaScadenza).toLocaleDateString('it-IT')}
                            </div>
                          )}
                          {l.contestatoMotivo && (
                            <div className="mt-1 text-[10px] text-red-700">
                              ⚠ {l.contestatoMotivo}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="mt-2 text-[10px] opacity-70">
                      Causale fattura: <span className="italic">{s.lines[0]?.causaleFattura}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
