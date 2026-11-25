import type { NextConfig } from 'next';
const config: NextConfig = { reactStrictMode: true, poweredByHeader: false, ...(process.env.NETDOCTOR_STATIC==='1' ? {output:'export' as const}: {}) };
export default config;
