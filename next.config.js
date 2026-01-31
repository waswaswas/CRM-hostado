/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix vendor-chunks resolution for lucide-react (client detail page, etc.)
  transpilePackages: ['lucide-react'],
  // Output configuration for cPanel
  output: 'standalone',
  
  // Disable image optimization if not using Next.js Image Optimization
  images: {
    unoptimized: false,
  },
  
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Ensure proper handling of static files
  trailingSlash: false,
  
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Skip TypeScript type checking during build (optional - remove if you want type checking)
  typescript: {
    ignoreBuildErrors: false, // Keep this false to catch type errors, but skip ESLint
  },
}

module.exports = nextConfig



