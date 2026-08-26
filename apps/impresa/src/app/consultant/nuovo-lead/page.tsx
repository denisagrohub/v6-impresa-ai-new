'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { InterviewTreeFlow } from '@/components/interview/InterviewTreeFlow';

// Compito "dashboard consulente" (Denis, 25/08/2026), criterio 1: un
// consulente (o l'Admin, stessa dashboard/stesse azioni disponibili, vedi
// consultant/dashboard/page.tsx) deve poter avviare la STESSA intervista ad
// albero usata dal visitatore pubblico, per un cliente che sta seguendo di
// persona - NON un form/wizard di prodotto nuovo (escluso esplicitamente da
// Denis). Il lead risultante si attribuisce automaticamente a chi lo crea
// (ruolo sourcing, vedi interview_api.py/start_interview +
// crm_lead.py/_set_sourcing_consulente), MAI tramite la logica di
// assegnazione automatica per zona/competenza (riservata ai lead pubblici).
//
// Pagina protetta (non in middleware.ts PUBLIC_PATHS): richiede pi_session
// valida, stesso controllo ruolo di consultant/dashboard/page.tsx.
export default function NuovoLeadPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = localStorage.getItem('pi_session');
        if (!session) {
            router.push('/login');
            return;
        }
        try {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'consultant' && parsed.role !== 'admin') {
                router.push('/login');
                return;
            }
            setUser(parsed);
        } catch {
            router.push('/login');
        } finally {
            setLoading(false);
        }
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
            <div className="max-w-2xl mx-auto mb-6">
                <Link href="/consultant/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#1a2744]">
                    <ArrowLeft size={16} /> Torna alla dashboard
                </Link>
            </div>
            <InterviewTreeFlow variant="consultant" authToken={user?.token} />
        </div>
    );
}
