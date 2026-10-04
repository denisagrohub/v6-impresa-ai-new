'use client';

// 04/10/2026 (C5-h): layout consulente. Aggiunge il FAB Andon
// a tutte le pagine /consultant/*, senza toccare admin/layout.tsx.

import AndonFAB from '@/components/admin/andon/AndonFAB';

export default function ConsultantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AndonFAB />
    </>
  );
}
