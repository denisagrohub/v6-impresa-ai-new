// ═══════════════════════════════════════════════════════════════════
// PartnerProjectHeader — top bar della dashboard partner-projects/[id].
// Estratto il 29/09/2026 (Refactor C, step C1.d) da:
//   app/admin/partner-projects/[id]/page.tsx
// Zero cambio UX: stesse classi, stesso ordine, stesse icone.
// Le callback sono raggruppate in `handlers` per leggibilità.
// ═══════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { ArrowLeft, Monitor, Settings } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { CharterEditor } from '@/components/CharterEditor';

type CharterShape = any; // pass-through verso CharterEditor

export type PartnerProjectHeaderHandlers = {
  /** Apre il playbook consulente in nuova tab. */
  onOpenPlaybook: () => void;
  /** Apre il pitch pubblico /p/<slug>. */
  onOpenPitchPublic: () => void;
  /** Precompila email con link al pitch. */
  onSendPitch: () => void;
  /** Apre modale nuova call (video + live note). */
  onNewVideoCall: () => void;
  /** Apre drawer live note (call gia' iniziata). */
  onLiveCall: () => void;
  /** Apre modale brief pre-call. */
  onBriefPrecall: () => void;
  /** Apre modale scouting azienda. */
  onScoutingCompany: () => void;
  /** Apre modale scouting relazione. */
  onScoutingRelation: () => void;
  /** Entra in modalita' presentazione. */
  onPresentation: () => void;
  /** Apre modale creazione sotto-progetto. */
  onNewSubproject: () => void;
  /** Apre modale impostazioni circuito. */
  onOpenSettings: () => void;
  /** Charter modificato dall'editor. */
  onCharterChanged: (c: CharterShape) => void;
};

type Props = {
  projectId: number;
  projectName: string;
  projectParentId: number | null;
  projectEmailAlias: string | null;
  projectCharter: CharterShape | null;
  handlers: PartnerProjectHeaderHandlers;
};

export function PartnerProjectHeader({
  projectId, projectName, projectParentId, projectEmailAlias, projectCharter,
  handlers,
}: Props) {
  const backHref = projectParentId
    ? `/admin/partner-projects/${projectParentId}`
    : '/admin/partner-projects';

  const aliasSlug = projectEmailAlias ? projectEmailAlias.split('@')[0] : null;

  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          href={backHref}
          className="text-gray-400 hover:text-gray-800 transition-colors"
          title={projectParentId ? 'Torna al progetto padre' : 'Torna ai progetti'}
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-[15px] font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
          <span>PROGETTO: {projectName}</span>
          {projectEmailAlias && (
            <span className="text-[11px] font-normal text-gray-400">({projectEmailAlias})</span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handlers.onOpenPlaybook}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
          title="Apri playbook consulente (stampa/PDF)"
        >
          📖 Playbook
        </button>

        {aliasSlug && (
          <button
            onClick={handlers.onOpenPitchPublic}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
            title="Apri pitch pubblico"
          >
            🌐 Pitch pubblico
          </button>
        )}

        {aliasSlug && (
          <button
            onClick={handlers.onSendPitch}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
            title="Precompila email con link al pitch"
          >
            ✉️ Invia pitch
          </button>
        )}

        <CharterEditor
          projectId={projectId}
          charter={projectCharter}
          onChanged={handlers.onCharterChanged}
        />

        {/* 📞 Nuova Call ▾ — pre/in/post in un unico punto */}
        <Dropdown
          label="📞 Nuova Call"
          variant="primary"
          items={[
            { label: '🎥 Video + Live Note', hint: 'Apre Discuss + drawer note', onClick: handlers.onNewVideoCall },
            { label: '📝 Solo Live Note', hint: 'Call già iniziata (telefono)', onClick: handlers.onLiveCall },
            { label: '📋 Prepara Brief', hint: 'Pre-call, prima di chiamare', onClick: handlers.onBriefPrecall },
          ]}
        />

        {/* 🔍 Scouting ▾ */}
        <Dropdown
          label="🔍 Scouting"
          items={[
            { label: '🏢 Scouting Azienda', hint: 'Per una parte del progetto', onClick: handlers.onScoutingCompany },
            { label: '🎯 Scouting Relazione', hint: 'Profilo target del progetto', onClick: handlers.onScoutingRelation },
          ]}
        />

        {/* 🎤 Presenta */}
        <button
          onClick={handlers.onPresentation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
          title="Modalità Presentazione"
        >
          <Monitor size={13} />
          Presenta
        </button>

        {/* + Crea sotto-progetto — solo su progetto radice */}
        {!projectParentId && (
          <Dropdown
            label="+ Nuovo"
            items={[
              { label: '📁 Crea sotto-progetto', onClick: handlers.onNewSubproject },
            ]}
          />
        )}

        <button
          onClick={handlers.onOpenSettings}
          className="p-1.5 text-gray-400 hover:text-[#1a7fa8] rounded transition-colors cursor-pointer"
          title="Impostazioni Circuito"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
