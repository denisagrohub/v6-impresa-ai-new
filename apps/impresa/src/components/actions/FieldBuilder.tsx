"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { DATA_TYPES, emptyField } from "@/lib/actions/schema";

const inputCls =
  "w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50";

export default function FieldBuilder({ label, hint, fields, onChange }: any) {
  const update = (i: number, patch: any) =>
    onChange(fields.map((f: any, idx: number) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</label>
        <span className="text-[11px] text-zinc-600">{hint}</span>
      </div>

      <div className="space-y-2">
        {fields.map((f: any, i: number) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-2">
            <input
              value={f.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="chiave"
              className={`${inputCls} flex-1 font-mono text-xs`}
            />
            <select
              value={f.type}
              onChange={(e) => update(i, { type: e.target.value })}
              className={`${inputCls} w-28 font-mono text-xs`}
            >
              {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => update(i, { required: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 accent-cyan-500"
              />
              Req.
            </label>
            <button
              onClick={() => onChange(fields.length > 1 ? fields.filter((_: any, idx: number) => idx !== i) : [emptyField()])}
              className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
              aria-label="Rimuovi campo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange([...fields, emptyField()])}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
      >
        <Plus className="h-3.5 w-3.5" /> Aggiungi campo
      </button>
    </div>
  );
}
