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
}
module.exports = nextConfig
