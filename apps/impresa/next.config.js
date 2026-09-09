/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erpv6/gateway-client', '@erpv6/auth', '@erpv6/ui'],
  experimental: { optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'] },
  images: { formats: ['image/avif', 'image/webp'] },
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
  // odoo-modules/ e' codice backend Odoo, non serve alla build del
  // frontend: senza questa esclusione il tracciamento file di Next.js
  // prova a leggere l'intera cartella (manifest Python inclusi) e questo
  // ha rotto il deploy su Vercel (ENOENT su un manifest durante il
  // build). L'endpoint che la legge a runtime (api/admin/deploy-odoo)
  // gestisce gia' la cartella assente con un fallback vuoto, quindi
  // escluderla dal bundle non cambia comportamento reale.
  outputFileTracingExcludes: {
    '/api/admin/deploy-odoo/**': ['../../odoo-modules/**'],
  },
  // 09/09/2026 (ritiro business-plan-pmi/business-plan-startup, dati
  // inventati + form mai collegato a Odoo): redirect() dentro il
  // Server Component di quelle pagine produceva un 307 "lato client"
  // (verificato dal vivo: nessun header Location, il corpo conteneva
  // il marker NEXT_REDIRECT nel payload RSC per il router client-side) -
  // curl/Googlebot non lo seguono affatto, serve un vero redirect HTTP
  // gestito qui, prima che Next.js risolva la pagina.
  async redirects() {
    return [
      { source: '/business-plan-pmi', destination: '/business-plan', permanent: true },
      { source: '/business-plan-startup', destination: '/business-plan', permanent: true },
    ];
  },
}
module.exports = nextConfig
