import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPost(slug: string) {
    try {
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.v6impresa.it';
        const r = await fetch(`${base}/api/public/blog/${slug}`, { cache: 'no-store' });
        if (!r.ok) return null;
        const d = await r.json();
        return d.post || null;
    } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const post = await getPost(params.slug);
    if (!post) return { title: 'Articolo non trovato' };
    return {
        title: post.title,
        description: post.subtitle,
        openGraph: { title: post.title, description: post.subtitle, type: 'article' },
    };
}

export default async function BlogArticle({ params }: { params: { slug: string } }) {
    const post = await getPost(params.slug);
    if (!post) notFound();

    return (
        <main className="min-h-screen bg-[#F7F3ED]">
            <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
                <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6">
                    <ArrowLeft size={16} /> Torna al blog
                </Link>
                <header className="mb-8">
                    <time dateTime={post.date} className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                        {new Date(post.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </time>
                    <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-[#0F1E3C]">{post.title}</h1>
                    {post.subtitle && <p className="mt-4 text-xl text-stone-600 leading-relaxed">{post.subtitle}</p>}
                </header>
                <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
            </article>
        </main>
    );
}
