'use client';
import { Inbox, User, Bot, FolderKanban, Users } from 'lucide-react';
import { projectColor } from '@/lib/email-hub/colors';

export type Scope = 'project' | 'personal' | 'system';
export type ProjectItem = { id: number; name: string; color: string; count: number };
export type PersonItem = { id: number; name: string; count: number };

type Props = {
  counters: { project: number; personal: number; system: number };
  projects: ProjectItem[];
  people: PersonItem[];
  activeScope: Scope;
  activeProject: number | null;
  activePerson: number | null;
  onScope: (s: Scope) => void;
  onProject: (id: number | null) => void;
  onPerson: (id: number | null) => void;
};

export default function EmailHubSidebar({
  counters, projects, people,
  activeScope, activeProject, activePerson,
  onScope, onProject, onPerson,
}: Props) {
  const scopes: { key: Scope; label: string; icon: any; count: number }[] = [
    { key: 'project',  label: 'Progetti',   icon: FolderKanban, count: counters.project },
    { key: 'personal', label: 'Personali',  icon: User,         count: counters.personal },
    { key: 'system',   label: 'Sistema',    icon: Bot,          count: counters.system },
  ];

  return (
    <aside className="w-[260px] shrink-0 border-r border-brand-border bg-brand-card overflow-y-auto email-hub-scroll">
      <div className="p-3 space-y-5">
        {/* Scope */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold px-2 mb-2">
            Viste
          </div>
          <div className="space-y-0.5">
            {scopes.map((s) => {
              const active = activeScope === s.key;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => { onScope(s.key); onProject(null); onPerson(null); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-brand-navy text-white'
                      : 'text-brand-text hover:bg-brand-sand'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-white' : 'text-brand-muted'} />
                  <span className="flex-1 text-left font-medium">{s.label}</span>
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                      active ? 'bg-white/20 text-white' : 'bg-brand-sand text-brand-muted'
                    }`}
                  >
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progetti */}
        {activeScope === 'project' && projects.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold px-2 mb-2">
              Progetti
            </div>
            <div className="space-y-0.5">
              {projects.map((p) => {
                const active = activeProject === p.id;
                const pc = projectColor(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onProject(active ? null : p.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-brand-sand text-brand-navy font-semibold'
                        : 'text-brand-text hover:bg-brand-sand'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: pc.color }}
                    />
                    <span className="flex-1 text-left truncate">{p.name || pc.name}</span>
                    <span className="text-[11px] text-brand-muted font-medium">
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Persone */}
        {activeScope === 'project' && people.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold px-2 mb-2">
              Persone
            </div>
            <div className="space-y-0.5">
              {people.map((p) => {
                const active = activePerson === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onPerson(active ? null : p.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-brand-sand text-brand-navy font-semibold'
                        : 'text-brand-text hover:bg-brand-sand'
                    }`}
                  >
                    <Users size={13} className="text-brand-muted shrink-0" />
                    <span className="flex-1 text-left truncate">{p.name}</span>
                    <span className="text-[11px] text-brand-muted font-medium">
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
