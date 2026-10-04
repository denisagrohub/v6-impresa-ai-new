'use client';

// 04/10/2026 (C5-h): FAB ambra per segnalazioni Andon.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AndonModal from './AndonModal';

export default function AndonFAB() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg flex items-center justify-center transition-colors"
          aria-label="Segnala un problema"
          title="Segnala un problema"
        >
          <AlertTriangle size={24} />
        </button>
      )}
      {open && <AndonModal onClose={() => setOpen(false)} />}
    </>
  );
}
