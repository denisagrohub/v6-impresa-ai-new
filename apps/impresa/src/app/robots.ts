import type { MetadataRoute } from "next";

// Convenzione Next.js App Router: compila a /robots.txt (09/09/2026,
// analisi SEO). Prima non esisteva nessuna route/file per questo -
// /robots.txt tornava un 307 verso /login (middleware, vedi
// middleware.ts) perche' l'estensione .txt non era esclusa dal controllo
// statico. Fix del middleware fatto insieme a questo file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/logout",
          "/dashboard",
          "/consultant/",
          "/admin/",
          "/bp/review",
          "/bp/delivery",
          "/checkout/",
          "/onboarding/",
          "/referral/dashboard",
          "/report/",
          "/booking/",
        ],
      },
    ],
    sitemap: "https://www.v6impresa.it/sitemap.xml",
  };
}
