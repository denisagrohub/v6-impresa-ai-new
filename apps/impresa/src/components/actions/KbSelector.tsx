"use client";

import React from "react";
import { Database, ChevronDown } from "lucide-react";
import { KB_CATALOG } from "@/lib/actions/schema";

export default function KbSelector({ selected = [], onChange }: any) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((k: string) => k !== id) : [...selected, id]);

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <Database className="h-3.5 w-3.5" /> Knowledge Base Richieste
      </label>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/40 p-1.5">
        {KB_CATALOG.map((kb) => {
          const checked = selected.includes(kb.id);
          return (
            <button
              key={kb.id}
              type="button"
              onClick={() => toggle(kb.id)}
              className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                checked ? "bg-cyan-500/10 text-cyan-300" : "text-zinc-400 hover:bg-zinc-800/60"
              }`}
            >
              <span>
                <span className="font-mono">{kb.id}</span>
                <span className="ml-2 text-zinc-600">{kb.name}</span>
              </span>
              {checked && <span className="text-[10px] font-semibold uppercase">selezionata</span>}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500">
          <ChevronDown className="h-3 w-3" />
          {selected.length} KB assegnate — il motore le userà per l'introspezione
        </p>
      )}
    </div>
  );
}
