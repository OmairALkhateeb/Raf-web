import type { NextConfig } from "next";

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

const isProduction = process.env.NODE_ENV === 'production';

// Only a convenience for local work. Production must supply the real host, so a
// misconfigured deploy fails loudly through lib/api/server/env.ts instead of
// quietly whitelisting localhost.
const DEV_FALLBACK_API_BASE_URL = 'http://127.0.0.1:8000';

/** Allow /storage/** from whichever origin API_BASE_URL points at. */
function backendMediaPatterns(): RemotePatterns {
  const raw = process.env.API_BASE_URL?.trim() || (isProduction ? '' : DEV_FALLBACK_API_BASE_URL);
  if (!raw) return [];

  try {
    const { protocol, hostname, port } = new URL(raw);
    if (protocol !== 'http:' && protocol !== 'https:') return [];
    return [
      {
        protocol: protocol === 'https:' ? 'https' : 'http',
        hostname,
        port,
        pathname: '/storage/**',
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    // Next 16 blocks optimizing local IPs by default, which breaks a Laravel
    // backend on 127.0.0.1 during development.
    dangerouslyAllowLocalIP: !isProduction,
    remotePatterns: [
      ...backendMediaPatterns(),
      // Retained for the pages still served from mock data.
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
