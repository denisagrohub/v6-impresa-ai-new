import type { MetadataRoute } from "next";
import { blogArticles } from "@/data/blog-articles";

// Convenzione Next.js App Router: compila a /sitemap.xml (09/09/2026,
// analisi SEO). Prima non esisteva - stesso problema di /robots.txt
// (redirect a /login via middleware, corretto insieme a questo file).
// Solo pagine PUBBLICHE e indicizzabili: niente /login, /dashboard,
// /consultant/*, /bp/review, /bp/delivery, /booking/[id] (dinamica,
// nessun elenco statico sensato), /report/[token] (link privati).
const BASE_URL = "https://www.v6impresa.it";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pagine: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/intervista", priority: 0.9, changeFrequency: "monthly" },
    { path: "/business-plan", priority: 0.9, changeFrequency: "monthly" },
    { path: "/analisi-aziendale", priority: 0.8, changeFrequency: "monthly" },
    { path: "/ricambio-generazionale", priority: 0.8, changeFrequency: "monthly" },
    { path: "/acquisto-tee", priority: 0.8, changeFrequency: "monthly" },
    { path: "/esg", priority: 0.8, changeFrequency: "monthly" },
    { path: "/team-building", priority: 0.8, changeFrequency: "monthly" },
    { path: "/formazione-aziendale", priority: 0.8, changeFrequency: "monthly" },
    { path: "/kaizen-lean", priority: 0.8, changeFrequency: "monthly" },
    { path: "/project-finance", priority: 0.7, changeFrequency: "monthly" },
    // business-plan-pmi/business-plan-startup RITIRATE (09/09/2026, vedi
    // i rispettivi page.tsx) - ora redirect permanenti verso /business-plan,
    // niente senso elencarle in un sitemap fresco.
    { path: "/partnership", priority: 0.6, changeFrequency: "monthly" },
    { path: "/casi-studio", priority: 0.6, changeFrequency: "monthly" },
    { path: "/metodo", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
    { path: "/chi-siamo", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contatti", priority: 0.5, changeFrequency: "yearly" },
  ];

  const paginePagine = pagine.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const articoli = blogArticles.map((a) => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [...paginePagine, ...articoli];
}
