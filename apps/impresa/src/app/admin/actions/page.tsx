"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Box } from "lucide-react";
import Toolbar from "@/components/actions/Toolbar";
import ActionTable from "@/components/actions/ActionTable";
import ActionDrawer from "@/components/actions/ActionDrawer";
import { actionsStore, emptyAction } from "@/lib/actions/schema";

export default function AdminActionsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    setActions(actionsStore.getAll());
    return actionsStore.subscribe(setActions);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => {
      if (filter !== "all" && a.origin !== filter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.action_id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    });
  }, [actions, query, filter]);

  const handleSave = (draft: any) => actionsStore.upsert(draft);
  const handleDelete = (id: string) => actionsStore.remove(id);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              <Box className="h-5 w-5 text-cyan-400" />
              Catalogo Azioni (Admin Dashboard)
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Azioni custom dei partner e autogenerate dal motore di introspezione Adaptive EOSv6.
            </p>
          </div>
          <button
            onClick={() => setEditing(emptyAction())}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" /> Nuova Azione
          </button>
        </header>

        <div className="space-y-4">
          <Toolbar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
          <ActionTable actions={filtered} onEdit={setEditing} onDelete={handleDelete} />
          <p className="text-xs text-zinc-600">
            {filtered.length} di {actions.length} azioni
          </p>
        </div>
      </div>

      <ActionDrawer
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </main>
  );
}
