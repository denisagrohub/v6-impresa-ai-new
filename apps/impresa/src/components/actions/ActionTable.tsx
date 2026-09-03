"use client";

import React from "react";
import { Pencil, Trash2, Bot, Handshake, Inbox } from "lucide-react";
import Badge from "./Badge";
import { ACTION_TYPES } from "@/lib/actions/schema";

function OriginBadge({ origin }: { origin: string }) {
  const t = ACTION_TYPES[origin] || { label: origin, tone: "gray" };
  return (
    <Badge tone={t.tone}>
      {origin === "custom_partner"
        ? <Handshake className="h-3 w-3" />
        : <Bot className="h-3 w-3" />}
      {t.label}
    </Badge>
  );
}

const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={status === "active" ? "green" : "gray"}>{status}</Badge>
);

export default function ActionTable({ actions, onEdit, onDelete }: any) {
  if (!actions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 py-20 text-center">
        <Inbox className="h-10 w-10 text-zinc-700" />
        <p className="mt-3 text-sm font-medium text-zinc-400">Nessuna azione trovata</p>
        <p className="mt-1 text-xs text-zinc-600">Modifica i filtri o crea una nuova azione.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="px-4 py-3 font-medium">Azione</th>
            <th className="px-4 py-3 font-medium">Origine</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">KB Richieste</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">I/O</th>
            <th className="px-4 py-3 font-medium">Stato</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {actions.map((a: any) => (
            <tr key={a.id} className="group transition-colors hover:bg-zinc-900/60">
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-100">{a.name}</p>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">{a.action_id}</p>
              </td>
              <td className="px-4 py-3"><OriginBadge origin={a.origin} /></td>
              <td className="hidden px-4 py-3 md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {a.requires_kb?.length
                    ? a.requires_kb.map((kb: string) => (
                        <span key={kb} className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{kb}</span>
                      ))
                    : <span className="text-xs text-zinc-600">—</span>}
                </div>
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <span className="text-xs text-zinc-400">{a.inputs?.length || 0} in</span>
                <span className="mx-1.5 text-zinc-700">·</span>
                <span className="text-xs text-zinc-400">{a.outputs?.length || 0} out</span>
              </td>
              <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => onEdit(a)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label={`Modifica ${a.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(a.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400" aria-label={`Elimina ${a.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
