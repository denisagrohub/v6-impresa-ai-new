"use client";

import React, { useEffect, useState } from "react";
import { Network, ArrowLeft, RefreshCw, Database } from "lucide-react";
import Link from "next/link";
import EosGraph from "@/components/actions/EosGraph";
import { actionsStore } from "@/lib/actions/schema";

export default function AdminGraphPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [source, setSource] = useState<"store" | "neo4j">("store");
  const [loading, setLoading] = useState(false);
  const [neo4jData, setNeo4jData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    setActions(actionsStore.getAll());
    const unsubscribe = actionsStore.subscribe(setActions);
    return () => { unsubscribe(); };
  }, []);

  const syncToNeo4j = async () => {
    setLoading(true);
    try {
      const currentActions = actionsStore.getAll();
      await fetch("/api/eos/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: currentActions }),
      });
      alert("Sincronizzazione con Neo4j completata con successo!");
    } catch (err) {
      console.error(err);
      alert("Errore durante la sincronizzazione con Neo4j");
    } finally {
      setLoading(false);
    }
  };

  const loadFromNeo4j = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/eos/graph");
      const data = await res.json();
      setNeo4jData(data);
      setSource("neo4j");
    } catch (err) {
      console.error(err);
      alert("Errore durante il caricamento da Neo4j");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/actions"
              className="rounded-md border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                <Network className="h-5 w-5 text-cyan-400" />
                Grafo DAG Adaptive EOSv6
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                Sincronizzazione nativa tra Motore Azioni Locale e Grafico Persistente Neo4j.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSource("store")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                source === "store"
                  ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Vista Motore Locale
            </button>
            <button
              onClick={loadFromNeo4j}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border ${
                source === "neo4j"
                  ? "bg-violet-950 border-violet-500 text-violet-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Carica da Neo4j
            </button>
            <button
              onClick={syncToNeo4j}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync Store → Neo4j
            </button>
          </div>
        </header>

        <EosGraph rawActions={source === "store" ? actions : neo4jData.nodes} />
      </div>
    </main>
  );
}
