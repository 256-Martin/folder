/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-postgres is a native-ish Node module; keep it out of the bundler so it
  // resolves normally on the server.
  serverExternalPackages: ['pg'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
