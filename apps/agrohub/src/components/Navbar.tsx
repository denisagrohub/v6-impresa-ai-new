'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

const links = [
  { href: '#metodo', label: 'Il metodo' },
  { href: '#checklist', label: 'Checklist PAC' },
  { href: '#prenota-call', label: 'Contatti' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-stone-700 hover:text-brand transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#checklist"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-green-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Fai la checklist
            </a>
          </div>

          <button
            onClick={() => setIsOpen((v) => !v)}
            className="md:hidden p-2 text-stone-700"
            aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 space-y-1 border-t border-stone-100">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block px-2 py-2.5 rounded-lg text-stone-700 hover:bg-stone-50 font-medium"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#checklist"
              onClick={() => setIsOpen(false)}
              className="block mt-2 px-2 py-2.5 rounded-lg bg-brand text-white text-center font-semibold"
            >
              Fai la checklist
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
