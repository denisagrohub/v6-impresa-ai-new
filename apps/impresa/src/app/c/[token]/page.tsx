"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

export default function MagicLinkPage() {
    const params = useParams();
    const router = useRouter();
    const token = params?.token as string;
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                const res = await fetch(`/api/auth/magic-link/${token}`, { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok || data.error) {
                    setError(data.error || 'Link non valido');
                    return;
                }

                // pulizia sessione precedente (sovrascrittura)
                localStorage.removeItem("pi_session");
                document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

                // salva nuova sessione
                const sessionData = JSON.stringify({
                    id: data.user.id,
                    login: data.user.login,
                    role: data.user.role,
                    name: data.user.name,
                    email: data.user.email,
                    emailSlug: data.user.email_slug || null,
                    clientId: String(data.user.id),
                    partnerId: data.user.partnerId,
                    token: data.token,
                });
                localStorage.setItem("pi_session", sessionData);
                document.cookie = `pi_session=${encodeURIComponent(sessionData)}; path=/; max-age=86400`;
                document.cookie = `token=${data.token}; path=/; max-age=86400`;

                // redirect
                router.replace(data.redirect_to || "/consultant/dashboard");
            } catch (e: any) {
                setError(e.message || 'Errore di rete');
            }
        })();
    }, [token, router]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">
                {error ? (
                    <div className="bg-white rounded-2xl border border-red-100 p-8">
                        <XCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-red-700 mb-2">Link non valido</h1>
                        <p className="text-sm text-gray-600 mb-4">{error}</p>
                        <p className="text-xs text-gray-400">
                            Chiedi a V6 Impresa un nuovo invio.
                        </p>
                    </div>
                ) : (
                    <>
                        <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Autenticazione in corso…</p>
                    </>
                )}
            </div>
        </div>
    );
}
