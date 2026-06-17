/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  reactCompiler: true,
  output: 'export',
  images: {
    unoptimized: true
  }
};

export default nextConfig;
