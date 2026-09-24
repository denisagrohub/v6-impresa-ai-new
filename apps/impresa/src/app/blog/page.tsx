import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Blog",
    description: "Approfondimenti sul metodo: business plan, DSCR, Kaizen e miglioramento continuo per PMI.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPosts() {
    try {
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.v6impresa.it';
        const r = await fetch(`${base}/api/public/blog`, { cache: 'no-store' });
        if (!r.ok) return [];
        const d = await r.json();
        return d.posts || [];
    } catch { return []; }
}

export default async function BlogPage() {
    const posts = await getPosts();

    return (
        <main className="min-h-screen bg-[#F7F3ED]">
            <section className="bg-[#0F1E3C] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] text-[#F8F6F2] sm:text-5xl">Blog</h1>
                    <p className="mt-6 text-lg leading-relaxed text-stone-300">
                        Approfondimenti sul metodo — niente numeri di marketing, solo come lavoriamo davvero.
                    </p>
                </div>
            </section>

            <section className="py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    {posts.length === 0 ? (
                        <p className="text-center text-stone-500">Nessun articolo pubblicato.</p>
                    ) : (
                        <div className="space-y-8">
                            {posts.map((a: any) => (
                                <Link key={a.slug} href={`/blog/${a.slug}`}
                                    className="block rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
                                    <time dateTime={a.date} className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                                        {new Date(a.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                                    </time>
                                    <h2 className="mt-4 font-serif text-2xl font-bold text-[#0F1E3C]">{a.title}</h2>
                                    {a.subtitle && <p className="mt-3 text-stone-600 leading-relaxed">{a.subtitle}</p>}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
