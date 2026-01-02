/** @type {import('next').NextConfig} */
const nextConfig = {
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
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Ensure proper handling of static files
  trailingSlash: false,
}

module.exports = nextConfig



