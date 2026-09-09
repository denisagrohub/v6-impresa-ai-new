import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { blogArticles } from "@/data/blog-articles";

export function generateStaticParams() {
    return blogArticles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
    const article = blogArticles.find((a) => a.slug === params.slug);
    if (!article) return {};
    return {
        title: article.title,
        description: article.excerpt,
        openGraph: { title: article.title, description: article.excerpt, type: "article" },
    };
}

export default function BlogArticlePage({ params }: { params: { slug: string } }) {
    const article = blogArticles.find((a) => a.slug === params.slug);
    if (!article) notFound();

    return (
        <main className="min-h-screen bg-[#F7F3ED]">
            <article className="py-16 sm:py-20">
                <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
                    <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-500 hover:text-stone-700">
                        <ArrowLeft size={14} aria-hidden="true" />
                        Tutti gli articoli
                    </Link>

                    <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
                        <time dateTime={article.date}>
                            {new Date(article.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                        </time>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                            <Clock size={12} aria-hidden="true" />
                            {article.readingMinutes} min di lettura
                        </span>
                    </div>

                    <h1 className="mt-4 text-balance font-serif text-3xl font-bold leading-[1.15] text-[#1C2128] sm:text-4xl">
                        {article.title}
                    </h1>

                    <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
                </div>
            </article>
        </main>
    );
}
