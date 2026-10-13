'use client';
import { Sparkles, CheckCircle2, ExternalLink, Send, Brain } from 'lucide-react';
import { projectColor } from '@/lib/email-hub/colors';

type Props = {
  project?: { id: number; name: string; color: string } | null;
  authorName?: string;
  subject?: string;
};

export default function IntelligencePanel({ project, authorName, subject }: Props) {
  const pc = project ? projectColor(project.id) : null;
  const who = authorName || 'questo contatto';
  const proj = pc?.name || project?.name || 'questo progetto';

  const summary = `Questo cliente ha mandato un'email su "${subject || 'senza oggetto'}" relativa a ${proj}. ${who} è già in contatto con noi — verifica se ci sono azioni in sospeso sul portfolio o follow-up da pianificare.`;

  return (
    <div className="p-4">
      {/* Card gradient */}
      <div
        className="rounded-2xl p-4 text-white shadow-hub-hover mb-3 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a2744 0%, #c85a3a 130%)',
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-8 -translate-x-8" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Brain size={14} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-wide">Susanna</div>
              <div className="text-[10px] text-white/70">intelligence contestuale</div>
            </div>
            <Sparkles size={12} className="ml-auto text-white/70" />
          </div>

          <p className="text-[12px] leading-relaxed text-white/95 mb-3">
            {summary}
          </p>

          <div className="flex flex-col gap-1.5">
            <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors backdrop-blur-sm">
              <CheckCircle2 size={12} /> Conferma ricezione
            </button>
            <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors backdrop-blur-sm">
              <ExternalLink size={12} /> Apri portfolio
            </button>
            <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors backdrop-blur-sm">
              <Send size={12} /> Follow-up
            </button>
          </div>
        </div>
      </div>

      {/* Contesto */}
      <div className="rounded-xl border border-brand-border bg-brand-card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold">
          Contesto
        </div>
        {project && pc && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: pc.color }}
            />
            <span className="text-brand-text font-medium truncate">
              {pc.name || project.name}
            </span>
          </div>
        )}
        {authorName && (
          <div className="flex items-center gap-2 text-xs text-brand-muted">
            <span>Da:</span>
            <span className="text-brand-text truncate">{authorName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
