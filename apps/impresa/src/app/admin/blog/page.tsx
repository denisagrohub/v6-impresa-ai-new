"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Edit3, Trash2, ExternalLink } from "lucide-react";

export default function AdminBlogPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/admin/blog/posts');
            const d = await r.json();
            if (!d.success) { setErr(d.error); return; }
            setPosts(d.posts || []);
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const s = localStorage.getItem("pi_session");
        if (!s) { router.push("/login"); return; }
        const u = JSON.parse(s);
        if (u.role !== 'admin') { router.push("/login"); return; }
        load();
    }, [router]);

    const del = async (id: number, title: string) => {
        if (!confirm(`Eliminare "${title}"?`)) return;
        const r = await fetch(`/api/admin/blog/posts/${id}`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) load();
        else alert(d.error);
    };

    if (loading && !posts.length) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={14} /> Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Blog</h1>
                        <p className="text-sm text-gray-500">Gestisci articoli pubblicati su v6impresa.it/blog</p>
                    </div>
                    <Link href="/admin/blog/new"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]">
                        <Plus size={18} /> Nuovo articolo
                    </Link>
                </div>

                {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-6">{err}</div>}

                {posts.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
                        Nessun articolo. Crea il primo cliccando "Nuovo articolo".
                    </div>
                ) : (
                    <div className="space-y-2">
                        {posts.map((p) => (
                            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-[#1a2744] truncate">{p.title}</h3>
                                    {p.subtitle && <p className="text-sm text-gray-500 truncate">{p.subtitle}</p>}
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                        <span className={p.isPublished ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                                            {p.isPublished ? '● Pubblicato' : '○ Bozza'}
                                        </span>
                                        {p.publishedDate && <span>· {new Date(p.publishedDate).toLocaleDateString('it-IT')}</span>}
                                        {p.visits > 0 && <span>· {p.visits} visite</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {p.isPublished && (
                                        <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Vedi">
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                    <Link href={`/admin/blog/${p.id}`}
                                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Modifica">
                                        <Edit3 size={16} />
                                    </Link>
                                    <button onClick={() => del(p.id, p.title)}
                                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Elimina">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
