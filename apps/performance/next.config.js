/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erpv6/gateway-client', '@erpv6/auth', '@erpv6/ui'],
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
}
module.exports = nextConfig
