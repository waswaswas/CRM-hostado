# Pre-Deployment Checklist

Use this checklist before deploying to cPanel:

## Pre-Deployment

- [ ] All code changes committed and pushed
- [ ] Application tested locally with `npm run build` and `npm start`
- [ ] No TypeScript or linting errors (`npm run lint`)
- [ ] Environment variables documented in `.env.production.example`
- [ ] `.env.production` file created with correct values (NOT committed to git)
- [ ] Supabase project configured and accessible
- [ ] Database migrations run in Supabase
- [ ] All required tables exist (clients, emails, reminders, notifications, etc.)

## Files to Upload

- [ ] All source files (app/, components/, lib/, types/, etc.)
- [ ] Configuration files (next.config.js, tsconfig.json, tailwind.config.ts, etc.)
- [ ] package.json and package-lock.json
- [ ] public/ folder (including robots.txt, sitemap.xml)
- [ ] .htaccess file
- [ ] .env.production (upload separately, keep secure)

## Files NOT to Upload

- [ ] node_modules/ (will be installed on server)
- [ ] .next/ (will be built on server)
- [ ] .env.local (use .env.production instead)
- [ ] .git/ folder
- [ ] *.log files
- [ ] .DS_Store files

## cPanel Configuration

- [ ] Node.js application created
- [ ] Node.js version set to 18.x or higher
- [ ] Application root directory set correctly
- [ ] Application URL set to gms.hostado.net
- [ ] Environment variables configured in cPanel:
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] CRON_SECRET (if using cron jobs)
  - [ ] NODE_ENV=production
  - [ ] PORT (check cPanel assigned port)

## Build and Start

- [ ] SSH into server
- [ ] Navigate to application directory
- [ ] Run `npm install --production`
- [ ] Run `npm run build`
- [ ] Verify .next folder created
- [ ] Start/restart Node.js application in cPanel
- [ ] Check application logs for errors

## Domain and SSL

- [ ] Domain gms.hostado.net points to application
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] HTTPS redirect enabled
- [ ] Test https://gms.hostado.net loads correctly

## Verification

- [ ] Application loads at https://gms.hostado.net
- [ ] Login page accessible
- [ ] Can log in with test credentials
- [ ] Dashboard loads correctly
- [ ] No console errors in browser
- [ ] robots.txt accessible at /robots.txt
- [ ] robots.txt shows "Disallow: /"
- [ ] Page source includes noindex meta tags
- [ ] HTTPS working (no mixed content warnings)

## Search Engine Blocking

- [ ] robots.txt file exists and blocks all crawlers
- [ ] Meta robots tags present in page source
- [ ] Sitemap.xml exists (can be empty)
- [ ] Test: Try accessing site with Googlebot user agent (should be blocked)

## Optional: Cron Jobs

- [ ] Email checking cron job set up (if needed)
- [ ] Reminder checking cron job set up (if needed)
- [ ] Tag removal cron job set up (if needed)
- [ ] CRON_SECRET configured and used in cron URLs

## Post-Deployment

- [ ] Monitor application logs for first 24 hours
- [ ] Test all major features:
  - [ ] Client creation
  - [ ] Email sending/receiving
  - [ ] Reminder creation
  - [ ] Notification system
  - [ ] Accounting features (if used)
- [ ] Set up monitoring/uptime checks (if available)
- [ ] Document any issues encountered

## Security

- [ ] Environment variables not exposed in client-side code
- [ ] HTTPS enforced
- [ ] RLS policies active in Supabase
- [ ] No sensitive data in git repository
- [ ] Dependencies up to date (`npm audit`)

## Backup

- [ ] Database backup configured in Supabase
- [ ] Code repository backed up
- [ ] Environment variables documented securely

