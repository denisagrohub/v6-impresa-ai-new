"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Users, Mail, ChevronRight } from "lucide-react";

interface PartnerProject {
    id: number;
    name: string;
    emailAlias: string | null;
    partnerCount: number;
}

export default function PartnerProjectsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [projects, setProjects] = useState<PartnerProject[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/admin/login");
            return;
        }
        (async () => {
            try {
                const res = await fetch('/api/admin/partner-projects');
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setLoadError(data.error || 'Odoo non raggiungibile');
                    return;
                }
                setProjects(data.projects || []);
            } catch (error: any) {
                setLoadError(error.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Progetti Partner</h1>
                        <p className="text-gray-500">Progetti con parti collegate (es. Progetto TEE) — email e comunicazioni</p>
                    </div>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Dati non aggiornati: {loadError}
                    </div>
                )}

                {projects.length === 0 && !loadError ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
                        Nessun progetto partner trovato.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((p) => (
                            <Link
                                key={p.id}
                                href={`/admin/partner-projects/${p.id}`}
                                className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-300 transition-colors"
                            >
                                <div>
                                    <div className="text-lg font-bold text-[#1a2744]">{p.name}</div>
                                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1"><Users size={14} /> {p.partnerCount} parti collegate</span>
                                        {p.emailAlias && (
                                            <span className="flex items-center gap-1"><Mail size={14} /> {p.emailAlias}</span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-gray-300" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
