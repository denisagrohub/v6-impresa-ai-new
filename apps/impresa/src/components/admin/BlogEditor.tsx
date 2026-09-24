"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Eye, ExternalLink, X } from "lucide-react";

export default function BlogEditor({ postId }: { postId?: number }) {
    const router = useRouter();
    const [loading, setLoading] = useState(!!postId);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const [form, setForm] = useState({
        title: '', subtitle: '', slug: '', content: '',
        publishedDate: '', isPublished: false,
    });

    useEffect(() => {
        if (!postId) return;
        (async () => {
            try {
                const r = await fetch(`/api/admin/blog/posts/${postId}`);
                const d = await r.json();
                if (!d.success) { setMsg({ ok: false, text: d.error }); return; }
                setForm({
                    title: d.post.title || '',
                    subtitle: d.post.subtitle || '',
                    slug: d.post.slug || '',
                    content: d.post.content || '',
                    publishedDate: d.post.publishedDate ? d.post.publishedDate.slice(0, 16) : '',
                    isPublished: !!d.post.isPublished,
                });
            } catch (e: any) { setMsg({ ok: false, text: e.message }); }
            finally { setLoading(false); }
        })();
    }, [postId]);

    const save = async () => {
        if (!form.title.trim()) { setMsg({ ok: false, text: 'Titolo obbligatorio' }); return; }
        setSaving(true); setMsg(null);
        try {
            const url = postId ? `/api/admin/blog/posts/${postId}` : '/api/admin/blog/posts';
            const method = postId ? 'PATCH' : 'POST';
            const r = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title, subtitle: form.subtitle, slug: form.slug,
                    content: form.content,
                    publishedDate: form.publishedDate || null,
                    isPublished: form.isPublished,
                }),
            });
            const d = await r.json();
            if (!d.success) { setMsg({ ok: false, text: d.error }); return; }
            setMsg({ ok: true, text: postId ? 'Aggiornato' : 'Creato' });
            if (!postId && d.id) router.push(`/admin/blog/${d.id}`);
        } catch (e: any) { setMsg({ ok: false, text: e.message }); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link href="/admin/blog" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={14} /> Blog
                        </Link>
                        <h1 className="text-2xl font-bold text-[#1a2744]">{postId ? 'Modifica articolo' : 'Nuovo articolo'}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {form.content && (
                            <button onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                                <Eye size={14} /> Anteprima
                            </button>
                        )}
                        {postId && form.isPublished && form.slug && (
                            <a href={`/blog/${form.slug}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                                <ExternalLink size={14} /> Vedi online
                            </a>
                        )}
                        <button onClick={save} disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-50">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {postId ? 'Salva' : 'Crea'}
                        </button>
                    </div>
                </div>

                {msg && (
                    <div className={`rounded-lg px-3 py-2 text-sm mb-4 ${msg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {msg.text}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Titolo *</label>
                        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-lg font-semibold" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Sottotitolo / Excerpt</label>
                        <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Slug URL</label>
                        <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" placeholder="es. dscr-cosa-guarda-la-banca" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Contenuto (HTML: p, h2, ul, a)</label>
                        <textarea rows={20} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Data pubblicazione</label>
                            <input type="datetime-local" value={form.publishedDate} onChange={(e) => setForm({ ...form, publishedDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Pubblica ora</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {previewOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-[#1a2744]">Anteprima</h2>
                            <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <h1 className="text-3xl font-bold text-[#1a2744] mb-2">{form.title}</h1>
                            {form.subtitle && <p className="text-lg text-gray-600 mb-6">{form.subtitle}</p>}
                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: form.content }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
