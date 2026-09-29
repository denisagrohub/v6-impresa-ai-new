// ═══════════════════════════════════════════════════════════════════
// DealVariablesPanel — variabili deal con editor inline per opzionali.
// Estratto il 29/09/2026 (C1.b) da:
//   app/admin/deals/[id]/page.tsx
// - variabili critiche: valore base readonly, bordo ambra
// - variabili opzionali: input editabile + toggle ON/OFF
// - source badge: manuale/contratto/progetto/formula/consuntivo
// ═══════════════════════════════════════════════════════════════════

import { SOURCE_LABELS as SOURCE_LABEL } from './constants';

type Variable = {
  id: number;
  name: string;
  label: string;
  unit: string;
  valueMin: number;
  valueBase: number;
  valueMax: number;
  valueText: string;
  source: string;
  isCritical: boolean;
  locked: boolean;
  enabled: boolean;
};

type Props = {
  variables: Variable[];
  actionLoading: string | null;
  onUpdate: (name: string, payload: { enabled?: boolean; valueBase?: number }) => void;
};

export function DealVariablesPanel({ variables, actionLoading, onUpdate }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
        Variabili ({variables.length})
      </div>
      <div className="divide-y divide-gray-100">
        {variables.map(v => {
          const isOptional = !v.isCritical;
          const isEditing = actionLoading === `var:${v.name}`;
          const src = SOURCE_LABEL[v.source] || { label: v.source, color: 'bg-gray-100 text-gray-600' };
          const rowStyle = isOptional
            ? (v.enabled
                ? 'border-l-4 border-l-green-400 bg-green-50/20'
                : 'border-l-4 border-l-gray-200 bg-gray-50/30 opacity-75')
            : 'border-l-4 border-l-amber-300';
          return (
            <div key={v.id} className={`px-4 py-2.5 text-sm ${rowStyle}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  {v.label || v.name}
                  {v.isCritical && (
                    <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      critica
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${src.color}`}>
                    {src.label}
                  </span>
                  <span className="text-xs text-gray-500">{v.unit}</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-600 items-center">
                {v.valueText ? (
                  <span className="font-mono">{v.valueText}</span>
                ) : (
                  <>
                    <span>MIN: <span className="font-mono">{v.valueMin.toLocaleString('it-IT')}</span></span>
                    <span className="flex items-center gap-1">
                      BASE:
                      {isOptional ? (
                        <input
                          type="number"
                          defaultValue={v.valueBase}
                          placeholder="0"
                          onBlur={(e) => {
                            const newVal = parseFloat(e.target.value);
                            if (!isNaN(newVal) && newVal !== v.valueBase) {
                              onUpdate(v.name, { valueBase: newVal, enabled: true });
                            }
                          }}
                          className="font-mono w-20 px-1 py-0.5 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="font-mono">{v.valueBase.toLocaleString('it-IT')}</span>
                      )}
                    </span>
                    <span>MAX: <span className="font-mono">{v.valueMax.toLocaleString('it-IT')}</span></span>
                    {isOptional && (
                      <button
                        onClick={() => onUpdate(v.name, { enabled: !v.enabled })}
                        disabled={isEditing}
                        className={`ml-auto text-[10px] uppercase font-semibold px-2 py-1 rounded transition-colors ${
                          v.enabled
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        } ${isEditing ? 'opacity-50' : ''}`}>
                        {isEditing ? '…' : (v.enabled ? 'ON' : 'OFF')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
