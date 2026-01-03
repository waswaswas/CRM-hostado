# Quick Deployment Guide for gms.hostado.net

## Quick Steps

1. **Build locally:**
   ```bash
   npm install
   npm run build
   npm start  # Test it works
   ```

2. **Upload to cPanel:**
   - Upload all files EXCEPT: `node_modules/`, `.next/`, `.env.local`
   - Upload to your domain directory (usually `public_html/gms.hostado.net` or similar)

3. **Set up Node.js app in cPanel:**
   - Create Node.js application
   - Set Node version to 18+
   - Set startup file: `server.js`
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NODE_ENV=production`

4. **SSH into server and run:**
   ```bash
   cd ~/gms.hostado.net  # or your domain path
   npm install --production
   npm run build
   ```

5. **Start the app in cPanel Node.js settings**

6. **Configure SSL** for `gms.hostado.net` in cPanel

7. **Verify:**
   - Visit `https://gms.hostado.net`
   - Check `/robots.txt` shows "Disallow: /"
   - Verify login works

## Important Files Created

- ✅ `public/robots.txt` - Blocks search engines
- ✅ `public/sitemap.xml` - Empty sitemap
- ✅ `.htaccess` - Apache configuration
- ✅ `next.config.js` - Production optimizations
- ✅ `DEPLOYMENT.md` - Full deployment guide
- ✅ `DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist
- ✅ `env.production.example` - Environment variables template

## Search Engine Blocking

The app is configured to NOT be indexed:
- ✅ `robots.txt` blocks all crawlers
- ✅ Meta robots tags in metadata
- ✅ Empty sitemap.xml

## Domain Configuration

- Domain: `gms.hostado.net`
- Should only be accessible via direct link (not indexed by Google)





