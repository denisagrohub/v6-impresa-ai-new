'use client';

import { useState } from 'react';
import {
  CheckCircle2, Clock, Lock, ChevronDown, ChevronUp,
  Loader2, X, PenLine, Upload, FileCheck, Cpu, Globe, ArrowRight
} from 'lucide-react';

export type ChecklistStep = {
  id: number;
  dealId: number;
  sequence: number;
  code: string;
  label: string;
  description: string;
  completionType: 'sign' | 'upload' | 'check' | 'system' | 'external';
  blocksDealState: boolean;
  requiresCodes: string;
  templateDocumentCode: string;
  status: 'pending' | 'in_progress' | 'done' | 'skipped' | 'na';
  isReady: boolean;
  isBlocking: boolean;
  signRequestId: number | null;
  completedAt: string | null;
  completedBy: string | null;
  evidenceNote: string;
  externalReference: string;
};

const ICON_BY_TYPE = {
  sign: PenLine, upload: Upload, check: FileCheck, system: Cpu, external: Globe,
} as const;

const TYPE_LABEL = {
  sign: 'Firma elettronica',
  upload: 'Carica documento',
  check: 'Conferma manuale',
  system: 'Evento di sistema',
  external: 'Attesa esterna',
} as const;

function StatusIcon({ step }: { step: ChecklistStep }) {
  if (step.status === 'done') return <CheckCircle2 size={16} className="text-emerald-600" />;
  if (step.status === 'skipped') return <CheckCircle2 size={16} className="text-gray-400" />;
  if (step.status === 'in_progress') return <Clock size={16} className="text-amber-600" />;
  if (!step.isReady) return <Lock size={16} className="text-gray-400" />;
  return <Clock size={16} className="text-gray-500" />;
}

export function DealWizardPanel({
  dealId,
  checklist,
  progressDone,
  progressTotal,
  nextStepId,
  authToken,
  onRefresh,
}: {
  dealId: number;
  checklist: ChecklistStep[];
  progressDone: number;
  progressTotal: number;
  nextStepId: number | null;
  authToken: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalStep, setModalStep] = useState<ChecklistStep | null>(null);

  if (!checklist || checklist.length === 0) return null;

  const nextStep = checklist.find(c => c.id === nextStepId) || null;
  const pct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  return (
    <section className="mb-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Wizard deal — {progressDone}/{progressTotal} step
          </h2>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs px-3 py-1 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1 shrink-0"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Chiudi' : 'Vedi tutti'}
        </button>
      </div>

      {nextStep ? (
        <div className="rounded-lg border border-indigo-300 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                Prossimo passo
              </div>
              <div className="font-semibold text-sm text-gray-900">{nextStep.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {TYPE_LABEL[nextStep.completionType]}
                {nextStep.requiresCodes && ` · richiede: ${nextStep.requiresCodes}`}
              </div>
            </div>
            <button
              onClick={() => setModalStep(nextStep)}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 shrink-0"
            >
              Procedi <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
          ✓ Tutti gli step completati
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-1.5">
          {checklist.map(step => {
            const Icon = ICON_BY_TYPE[step.completionType];
            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 p-2 rounded border text-xs ${
                  step.status === 'done' ? 'bg-emerald-50/40 border-emerald-200' :
                  !step.isReady ? 'bg-gray-50 border-gray-200 opacity-60' :
                  step.id === nextStepId ? 'bg-indigo-50 border-indigo-300' :
                  'bg-white border-gray-200'
                }`}
              >
                <StatusIcon step={step} />
                <Icon size={12} className="text-gray-500 shrink-0" />
                <span className="flex-1 font-medium text-gray-800 truncate">
                  {step.sequence}. {step.label}
                </span>
                {step.blocksDealState && step.status !== 'done' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                    bloccante
                  </span>
                )}
                {step.completedAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(step.completedAt).toLocaleDateString('it-IT')}
                  </span>
                )}
                {step.status === 'pending' && step.isReady && (
                  <button
                    onClick={() => setModalStep(step)}
                    className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                  >
                    Apri
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalStep && (
        <StepWizardModal
          step={modalStep}
          authToken={authToken}
          onClose={() => setModalStep(null)}
          onComplete={() => {
            setModalStep(null);
            onRefresh();
          }}
        />
      )}
    </section>
  );
}


function StepWizardModal({
  step,
  authToken,
  onClose,
  onComplete,
}: {
  step: ChecklistStep;
  authToken: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [note, setNote] = useState('');
  const [externalRef, setExternalRef] = useState(step.externalReference || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/checklist/${step.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `JWT ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null, external_reference: externalRef || null }),
      });
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      onComplete();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isSignStep = step.completionType === 'sign';
  const hint = {
    sign: 'Clicca "Genera e invia documento" per generare il PDF e inviare la firma via Documenso. Lo step si completa automaticamente alla ricezione della firma.',
    upload: 'Allega il PDF firmato oppure segna lo step con una nota (upload file disponibile prossimamente).',
    check: 'Conferma di aver completato questa azione. Puoi aggiungere una nota.',
    system: 'Questo step è automatico. Verrà marcato done dal sistema quando l\'evento si verifica.',
    external: 'Attesa di un evento esterno (es. incasso bancario). Inserisci riferimento se disponibile.',
  }[step.completionType];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Step {step.sequence} — {TYPE_LABEL[step.completionType]}
            </div>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5">{step.label}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
            {hint}
          </div>

          {step.description && (
            <div className="text-xs text-gray-500 italic">{step.description}</div>
          )}

          {step.completionType === 'external' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Riferimento esterno
              </label>
              <input
                id="wizard-external-ref"
                name="external_reference"
                value={externalRef}
                onChange={e => setExternalRef(e.target.value)}
                placeholder="Es. CRO bonifico, ID transazione, ..."
                className="w-full px-3 py-1.5 rounded border text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nota {step.completionType === 'check' && '(richiesta per audit)'}
            </label>
            <textarea
              id="wizard-note"
              name="note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Dettagli dell'azione, data, chi ha firmato, ..."
              className="w-full px-3 py-1.5 rounded border text-sm resize-y"
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        {isSignStep && signResult && (
          <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-200">
            <div className="text-xs text-emerald-800 font-semibold mb-1">
              ✓ Documento inviato in firma
            </div>
            <a
              href={signResult.requestUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 underline break-all"
            >
              {signResult.requestUrl}
            </a>
            <div className="text-[10px] text-emerald-600 mt-1">
              Il firmatario riceverà email con il link. Lo step si chiuderà automaticamente alla firma.
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-white"
          >
            Chiudi
          </button>

          {isSignStep && !signResult && (
            <button
              onClick={handleSendDocument}
              disabled={sendBusy}
              className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {sendBusy && <Loader2 size={12} className="animate-spin" />}
              {sendBusy ? 'Genero e invio...' : 'Genera e invia documento'}
            </button>
          )}

          {isSignStep && signResult && (
            <button
              onClick={handleComplete}
              disabled={busy}
              className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              {busy ? 'Salvataggio…' : 'Segna manualmente completato'}
            </button>
          )}

          {!isSignStep && (
            <button
              onClick={handleComplete}
              disabled={busy}
              className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              {busy ? 'Salvataggio…' : 'Segna come completato'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
