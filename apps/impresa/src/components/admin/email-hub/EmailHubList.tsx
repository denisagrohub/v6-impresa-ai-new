'use client';
import { Loader2, Inbox } from 'lucide-react';
import EmailHubListItem, { Message } from './EmailHubListItem';

type Props = {
  loading: boolean;
  messages: Message[];
  selectedId: number | null;
  onSelect: (m: Message) => void;
  emptyLabel?: string;
};

export default function EmailHubList({
  loading, messages, selectedId, onSelect, emptyLabel = 'Nessuna email',
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-brand-muted" />
      </div>
    );
  }
  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 rounded-2xl bg-brand-sand mx-auto mb-3 flex items-center justify-center">
            <Inbox size={20} className="text-brand-muted" />
          </div>
          <p className="text-sm text-brand-muted">{emptyLabel}</p>
        </div>
      </div>
    );
  }
  return (
    <main className="flex-1 overflow-y-auto email-hub-scroll">
      <div className="p-3 space-y-2">
        {messages.map((m) => (
          <EmailHubListItem
            key={m.id}
            message={m}
            active={selectedId === m.id}
            onClick={() => onSelect(m)}
          />
        ))}
      </div>
    </main>
  );
}
