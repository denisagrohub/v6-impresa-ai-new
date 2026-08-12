/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erpv6/gateway-client', '@erpv6/auth', '@erpv6/ui'],
  experimental: { optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'] },
  images: { formats: ['image/avif', 'image/webp'] },
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
}
module.exports = nextConfig
