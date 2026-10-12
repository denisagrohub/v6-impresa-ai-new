'use client';
// ═══════════════════════════════════════════════════════════════════
// 13/10/2026 (C-email-hub-2) — Fase 1: layout 3 colonne placeholder.
// Fase 2: sidebar + lista + dettaglio (dati reali).
// Fase 3: intelligence + polish + azioni.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import EmailHubHeader from '@/components/admin/email-hub/EmailHubHeader';

export default function EmailHubPage() {
  const [search, setSearch] = useState('');

  return (
    <AdminLayout title="Email Hub" fullWidth={true}>
      <div className="h-screen flex flex-col bg-brand-sand">
        <EmailHubHeader
          search={search}
          onSearchChange={setSearch}
          totalLabel="— messaggi"
        />

        <div className="flex-1 flex overflow-hidden">
          {/* ─── Colonna 1: Sidebar (260px) ─── */}
          <aside className="w-[260px] shrink-0 border-r border-brand-border bg-brand-card overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="text-xs uppercase tracking-wider text-brand-muted font-semibold">
                Viste
              </div>
              <div className="space-y-1.5">
                <div className="h-8 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-8 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-8 rounded-lg bg-brand-sand animate-pulse" />
              </div>
              <div className="text-xs uppercase tracking-wider text-brand-muted font-semibold pt-4">
                Progetti
              </div>
              <div className="space-y-1.5">
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
              </div>
              <div className="text-xs uppercase tracking-wider text-brand-muted font-semibold pt-4">
                Persone
              </div>
              <div className="space-y-1.5">
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
                <div className="h-7 rounded-lg bg-brand-sand animate-pulse" />
              </div>
            </div>
          </aside>

          {/* ─── Colonna 2: Lista (1fr) ─── */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-brand-card rounded-xl border border-brand-border p-4 shadow-hub-card"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="h-4 w-2/3 rounded bg-brand-sand animate-pulse" />
                    <div className="h-3 w-12 rounded bg-brand-sand animate-pulse" />
                  </div>
                  <div className="h-3 w-1/3 rounded bg-brand-sand animate-pulse mb-2" />
                  <div className="h-3 w-full rounded bg-brand-sand animate-pulse" />
                </div>
              ))}
            </div>
          </main>

          {/* ─── Colonna 3: Dettaglio (520px) ─── */}
          <aside className="w-[520px] shrink-0 border-l border-brand-border bg-brand-card shadow-hub-panel overflow-y-auto">
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-xs">
                <div className="w-14 h-14 rounded-2xl bg-brand-sand mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">✉️</span>
                </div>
                <p className="text-sm text-brand-muted">
                  Seleziona un&apos;email dalla lista per vederla qui.
                </p>
                <p className="text-xs text-brand-muted mt-2 opacity-70">
                  Fase 1 — layout placeholder. Dati in Fase 2.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
