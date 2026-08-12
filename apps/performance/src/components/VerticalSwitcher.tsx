'use client';

import { useId, useState } from 'react';
import { Badge } from '@erpv6/ui';

interface Vertical {
  id: string;
  label: string;
  tagline: string;
  fields: string[];
}

const verticals: Vertical[] = [
  {
    id: 'carrozzeria',
    label: 'Carrozzeria',
    tagline: 'Preventivi, ricambi e tempi di officina in un unico posto.',
    fields: ['Preventivo danni', 'Ricambi da ordinare', 'Tempi di officina', 'Foto prima/dopo'],
  },
  {
    id: 'stampa',
    label: 'Stampa',
    tagline: 'Commesse, materiali e bozze cliente senza fogli sparsi.',
    fields: ['Commesse di stampa', 'Materiali e formati', 'Bozze da approvare', 'Consegna prevista'],
  },
  {
    id: 'falegnameria',
    label: 'Falegnameria',
    tagline: 'Distinta base e misure su commessa, pensate per il mestiere.',
    fields: ['Distinta base', 'Misure su commessa', 'Tempi di lavorazione', 'Fornitori legname'],
  },
];

export function VerticalSwitcher() {
  const [activeId, setActiveId] = useState(verticals[0].id);
  const panelId = useId();
  const active = verticals.find((v) => v.id === activeId) ?? verticals[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Scegli un settore da vedere in anteprima">
        {verticals.map((vertical) => {
          const isActive = vertical.id === activeId;
          return (
            <button
              key={vertical.id}
              type="button"
              aria-pressed={isActive}
              aria-controls={panelId}
              onClick={() => setActiveId(vertical.id)}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 ${
                isActive
                  ? 'bg-sky-700 text-white shadow-md'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
              }`}
            >
              {vertical.label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-sky-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-300" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-sky-300" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-sky-300" aria-hidden="true" />
          </div>
          <Badge variant="info" className="bg-sky-100 text-sky-800">
            Anteprima — visione in costruzione
          </Badge>
        </div>

        <div className="p-6">
          <h3 className="font-sans text-lg font-semibold text-gray-900">{active.label}</h3>
          <p className="mt-1 text-sm text-gray-600">{active.tagline}</p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {active.fields.map((field) => (
              <li
                key={field}
                className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4 shrink-0 text-sky-500"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10.5 8 14l8-8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {field}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
