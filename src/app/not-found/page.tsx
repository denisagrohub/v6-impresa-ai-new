'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="text-center animate-fadeIn">
        <div className="text-8xl mb-6">🔍</div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
          Pagina non trovata
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <Link href="/">
          <Button size="lg">
            🏠 Torna alla Home
          </Button>
        </Link>
      </div>
    </main>
  );
}
