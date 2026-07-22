import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ProjectProgressContent from './ProjectProgressContent';

// Forza il rendering dinamico per evitare problemi di cache
export const dynamic = 'force-dynamic';

export default function ProjectProgressPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
                <span className="ml-3 text-gray-600 font-medium">Caricamento dashboard progetto...</span>
            </div>
        }>
            <ProjectProgressContent />
        </Suspense>
    );
}