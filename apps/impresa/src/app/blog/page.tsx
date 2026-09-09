import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { blogArticles } from "@/data/blog-articles";

export const metadata: Metadata = {
    title: "Blog",
    description: "Approfondimenti sul metodo: business plan, DSCR, Kaizen e miglioramento continuo per PMI.",
};

export default function BlogPage() {
    return (
        <main className="min-h-screen bg-[#F7F3ED]">
            <section className="bg-[#0F1E3C] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] text-[#F8F6F2] sm:text-5xl">
                        Blog
                    </h1>
                    <p className="mt-6 text-lg leading-relaxed text-stone-300">
                        Approfondimenti sul metodo — niente numeri di marketing, solo come lavoriamo davvero.
                    </p>
                </div>
            </section>

            <section className="py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <div className="space-y-8">
                        {blogArticles.map((a) => (
                            <Link
                                key={a.slug}
                                href={`/blog/${a.slug}`}
                                className="block rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
                            >
                                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
                                    <time dateTime={a.date}>
                                        {new Date(a.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                                    </time>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock size={12} aria-hidden="true" />
                                        {a.readingMinutes} min di lettura
                                    </span>
                                </div>
                                <h2 className="mt-3 text-balance font-serif text-2xl font-bold text-[#1C2128]">{a.title}</h2>
                                <p className="mt-3 text-stone-600">{a.excerpt}</p>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#D4703A]">
                                    Leggi l&rsquo;articolo
                                    <ArrowRight size={14} aria-hidden="true" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
