"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// 10/09/2026 (Denis, sulle pagine pubbliche che linkavano tutte
// "/booking/1" scritto a mano, sempre lo stesso consulente: "deve
// andare ad un qualsiasi altro consulente diverso da me solo se io non
// ho slot") - punto di ingresso unico: risolve il consulente giusto al
// volo (/api/booking/resolve-consultant) e ridirige alla pagina di
// prenotazione reale, invece di un id fisso in ogni pagina chiamante.
export default function BookingEntryPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/booking/resolve-consultant')
            .then((res) => res.json())
            .then((data) => {
                if (data.consultantId) {
                    router.replace(`/booking/${data.consultantId}`);
                } else {
                    setError(data.error || 'Nessun consulente disponibile al momento.');
                }
            })
            .catch(() => setError('Errore di rete, riprova più tardi.'));
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
            {error ? (
                <div className="max-w-md text-center">
                    <h1 className="text-xl font-bold text-[#1a2744] mb-2">Prenotazione non disponibile</h1>
                    <p className="text-gray-500">{error}</p>
                </div>
            ) : (
                <Loader2 size={40} className="animate-spin text-orange-500" />
            )}
        </div>
    );
}
