import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // PWA config (Fase 4 - se activará con next-pwa)
  // experimental: { serverActions: { bodySizeLimit: '2mb' } },
}

export default nextConfig
