/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    typedRoutes: false,
  },
  typescript: {
    tsconfigPath: './tsconfig.next.json',
  },
  // Point to the src/ui directory
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  webpack: (config) => {
    // Allow webpack to resolve .js imports to .ts files
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
