import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  images: {
    // replace `domains` with `remotePatterns` (see warning)
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'ui-avatars.com', pathname: '/api/**' },
    ],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // output: 'standalone',   // <- REMOVE this line
};

export default bundleAnalyzer(nextConfig);