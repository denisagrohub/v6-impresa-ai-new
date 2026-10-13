'use client';
// ═══════════════════════════════════════════════════════════════════
// 13/10/2026 (C-email-hub-2) — Fase 2: sidebar + lista + dettaglio.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import EmailHubHeader from '@/components/admin/email-hub/EmailHubHeader';
import EmailHubSidebar, { Scope, ProjectItem, PersonItem } from '@/components/admin/email-hub/EmailHubSidebar';
import EmailHubList from '@/components/admin/email-hub/EmailHubList';
import EmailHubDetail from '@/components/admin/email-hub/EmailHubDetail';
import { Message } from '@/components/admin/email-hub/EmailHubListItem';
import PackageGeneratorModal, { GeneratorContext } from '@/components/admin/orchestrator/PackageGeneratorModal';
import { getAuthToken } from '@/components/deal/auth';

const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `JWT ${token}` } : {};
};

export default function EmailHubPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [scope, setScope] = useState<Scope>('project');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [personId, setPersonId] = useState<number | null>(null);

  const [counters, setCounters] = useState({ project: 0, personal: 0, system: 0 });
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 13/10/2026 (STEP D): modale generatore documenti
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorCtx, setGeneratorCtx] = useState<GeneratorContext>({});

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch sidebar
  const loadSidebar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/email-hub/sidebar', { headers: authHeaders() });
      const d = await r.json();
      const data = d.data || d;
      if (data.success) {
        setCounters(data.counters || { project: 0, personal: 0, system: 0 });
        setProjects(data.projects || []);
        setPeople(data.people || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSidebar(); }, [loadSidebar]);

  // Fetch messaggi
  const loadMessages = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('limit', '100');
      if (projectId) params.set('project_id', String(projectId));
      if (personId) params.set('partner_id', String(personId));
      if (debouncedSearch) params.set('search', debouncedSearch);
      const r = await fetch(`/api/admin/email-hub/messages?${params}`, { headers: authHeaders() });
      const d = await r.json();
      const data = d.data || d;
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch { /* ignore */ }
    finally { setLoadingList(false); }
  }, [scope, projectId, personId, debouncedSearch]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  return (
    <AdminLayout title="Email Hub" fullWidth={true}>
      <div className="h-screen flex flex-col bg-brand-sand">
        <EmailHubHeader
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => { loadSidebar(); loadMessages(); }}
          totalLabel={`${messages.length} messaggi`}
        />

        <div className="flex-1 flex overflow-hidden">
          <EmailHubSidebar
            counters={counters}
            projects={projects}
            people={people}
            activeScope={scope}
            activeProject={projectId}
            activePerson={personId}
            onScope={setScope}
            onProject={setProjectId}
            onPerson={setPersonId}
          />

          <EmailHubList
            loading={loadingList}
            messages={messages}
            selectedId={selectedId}
            onSelect={(m) => setSelectedId(m.id)}
            emptyLabel={
              scope === 'project' ? 'Nessuna email di progetto'
                : scope === 'personal' ? 'Nessuna email personale'
                : 'Nessuna email di sistema'
            }
          />

          <EmailHubDetail
            messageId={selectedId}
            authHeaders={authHeaders}
            onClose={() => setSelectedId(null)}
            onReplied={() => { loadSidebar(); loadMessages(); }}
            onOpenGenerator={(ctx) => {
              setGeneratorCtx(ctx);
              setGeneratorOpen(true);
            }}
          />
        </div>
      </div>

      <PackageGeneratorModal
        open={generatorOpen}
        context={generatorCtx}
        authHeaders={authHeaders}
        onClose={() => setGeneratorOpen(false)}
      />
    </AdminLayout>
  );
}
