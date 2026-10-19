import type { NextConfig } from 'next';

const githubPages = process.env.GITHUB_PAGES === 'true';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, ''),
  ...(githubPages ? { output: 'export', trailingSlash: true } : {}),
};
export default nextConfig;
