/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erpv6/gateway-client', '@erpv6/auth', '@erpv6/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}
module.exports = nextConfig
