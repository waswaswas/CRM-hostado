/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix vendor-chunks resolution for lucide-react (client detail page, etc.)
  transpilePackages: ['lucide-react'],
  // Opt out packages that use Node.js-specific features from bundling
  // (fixes MODULE_NOT_FOUND ./vendor-chunks/nodemailer.js and similar)
  serverExternalPackages: ['@supabase/ssr', '@supabase/supabase-js', 'nodemailer'],
  // Output configuration for cPanel
  output: 'standalone',
  
  // Disable image optimization if not using Next.js Image Optimization
  images: {
    unoptimized: false,
  },
  
  // Don't bake env into build - use process.env at runtime to avoid startup validation errors
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



