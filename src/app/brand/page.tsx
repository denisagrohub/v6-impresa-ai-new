'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, Palette, PenTool, BarChart3, ArrowRight } from 'lucide-react';

export default function BrandPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="primary" className="bg-orange-500 text-white mb-4">🎨 Brand & Marketing</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Crea un Brand che <span className="text-orange-500">Parla la Tua Lingua</span>
          </h1>
          <p className="text-xl text-gray-600">
            Basato sul tuo profilo psicologico (DISC), generiamo colori, font, storytelling e un piano marketing su misura per te.
          </p>
        </div>

        {/* Pacchetti Brand */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="p-6 text-center hover:shadow-xl transition-all">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Brand Express</h2>
            <p className="text-4xl font-bold text-orange-500 my-3">€700</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>✅ Analisi brand AI (DISC-based)</li>
              <li>✅ Naming & Domain Check</li>
              <li>✅ Palette colori + Font</li>
              <li>✅ Brand Story base</li>
              <li>✅ Report PDF 10 pagine</li>
            </ul>
            <Link href="/brand/express">
              <Button variant="primary" fullWidth>Inizia Ora</Button>
            </Link>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-all border-2 border-orange-500 relative">
            <Badge variant="primary" className="absolute -top-3 right-4 bg-orange-500 text-white">⭐ Consigliato</Badge>
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <Palette size={32} className="text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Brand Pro</h2>
            <p className="text-4xl font-bold text-orange-500 my-3">€1.500</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>✅ Tutto del Express</li>
              <li>✅ Brand Guidelines complete</li>
              <li>✅ Moodboard</li>
              <li>✅ Key Messages</li>
              <li>✅ Report PDF 25+ pagine</li>
            </ul>
            <Link href="/brand/pro">
              <Button variant="primary" fullWidth>Inizia Ora</Button>
            </Link>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-all">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <PenTool size={32} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Brand Executive</h2>
            <p className="text-4xl font-bold text-orange-500 my-3">€3.500</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>✅ Tutto del Pro</li>
              <li>✅ Marketing Plan integrato</li>
              <li>✅ Storytelling avanzato</li>
              <li>✅ 1 call consulente</li>
              <li>✅ Report PDF 40+ pagine</li>
            </ul>
            <Link href="/brand/executive">
              <Button variant="primary" fullWidth>Inizia Ora</Button>
            </Link>
          </Card>
        </div>

        {/* CTA Layout */}
        <div className="mt-16 text-center">
          <Badge variant="outline" className="mb-4">🎨 Scegli il layout perfetto</Badge>
          <h2 className="text-3xl font-bold text-[#1a2744] mb-4">Vuoi anche un sito web?</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            I nostri layout sono personalizzati con i colori e il font del tuo brand.
          </p>
          <Link href="/layouts">
            <Button size="lg" className="shadow-lg hover:shadow-xl">
              🖼️ Vedi Vetrina Layout
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
