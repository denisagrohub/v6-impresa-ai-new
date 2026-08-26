'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { InterviewTreeFlow } from '@/components/interview/InterviewTreeFlow';

// Frontend pubblico dell'intervista ad albero (erpv6.interview.session lato
// Odoo, vedi odoo-modules/erpv6_production/models/interview_engine.py). A
// differenza di /intervista (form statico a fasi fisse con scoring
// client-side per i pacchetti Business Plan), qui ogni domanda arriva
// dinamicamente da Odoo.
//
// Passo successivo di /intervista (quiz statico che cattura il lead), non
// un percorso alternativo: se arriva ?lead_id=<crm.lead id reale>, riparte
// sullo STESSO lead invece di chiedere di nuovo nome/email e crearne uno
// nuovo per errore.
//
// 25/08/2026 (compito "dashboard consulente"): la UI/logica vera vive ora in
// components/interview/InterviewTreeFlow.tsx, riusata TALE E QUALE anche da
// /consultant/nuovo-lead (variant="consultant", con JWT della sessione) -
// questa pagina resta solo il wrapper pubblico (variant="public", default).

function IntervistaGuidataContent() {
    const searchParams = useSearchParams();
    const incomingLeadIdRaw = searchParams.get('lead_id');
    const incomingLeadId = incomingLeadIdRaw && /^\d+$/.test(incomingLeadIdRaw) ? Number(incomingLeadIdRaw) : null;

    return (
        <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
            <div className="container px-4">
                <InterviewTreeFlow
                    variant="public"
                    incomingLeadId={incomingLeadId}
                    initialName={searchParams.get('name') || ''}
                    initialEmail={searchParams.get('email') || ''}
                />
            </div>
        </main>
    );
}

export default function IntervistaGuidataPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
            <IntervistaGuidataContent />
        </Suspense>
    );
}
