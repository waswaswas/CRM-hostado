# Deployment Guide for cPanel

This guide will help you deploy the CRM application to cPanel hosting at `gms.hostado.net`.

## Prerequisites

- cPanel access with Node.js support
- Domain configured: `gms.hostado.net`
- Supabase project set up
- FTP/SSH access to cPanel

## Step 1: Prepare the Project Locally

1. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

2. **Test the build locally:**
   ```bash
   npm start
   ```
   Verify everything works at `http://localhost:3000`

## Step 2: Configure Environment Variables

1. Create a `.env.production` file in the project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   CRON_SECRET=your_secure_random_string
   NODE_ENV=production
   PORT=3000
   ```

2. **Important:** Never commit `.env.production` to git. It should be in `.gitignore`.

## Step 3: Upload to cPanel

### Option A: Using cPanel File Manager

1. Log into cPanel
2. Navigate to **File Manager**
3. Go to your domain's root directory (usually `public_html` or `gms.hostado.net`)
4. Upload all project files **except**:
   - `node_modules/` (will be installed on server)
   - `.env.local` (use `.env.production` instead)
   - `.git/` (if present)
   - `*.log` files

### Option B: Using FTP/SFTP

1. Connect to your cPanel via FTP/SFTP
2. Upload all files to the domain root directory
3. Ensure file permissions are correct (755 for directories, 644 for files)

## Step 4: Set Up Node.js Application in cPanel

1. In cPanel, find **"Node.js Selector"** or **"Setup Node.js App"**
2. Click **"Create Application"**
3. Configure:
   - **Node.js Version:** 18.x or higher
   - **Application Root:** `/home/username/gms.hostado.net` (or your domain path)
   - **Application URL:** `gms.hostado.net`
   - **Application Startup File:** `server.js` (Next.js will create this)
   - **Application Mode:** Production

4. **Set Environment Variables:**
   - Click on your application
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `CRON_SECRET` (optional)
     - `NODE_ENV=production`
     - `PORT=3000` (or the port assigned by cPanel)

## Step 5: Install Dependencies and Build

### Via SSH (Recommended):

1. SSH into your cPanel account
2. Navigate to your application directory:
   ```bash
   cd ~/gms.hostado.net
   # or
   cd ~/public_html/gms.hostado.net
   ```

3. Install dependencies:
   ```bash
   npm install --production
   ```

4. Build the application:
   ```bash
   npm run build
   ```

5. Verify the `.next` folder was created

### Via cPanel Terminal:

If SSH is not available, use cPanel's **Terminal** feature and follow the same steps.

## Step 6: Configure the Application

1. **Update the startup command:**
   In the Node.js app settings, set:
   - **Startup File:** `server.js`
   - **Run Command:** `npm start` or `node server.js`

2. **Set the correct port:**
   - Check what port cPanel assigned (usually shown in Node.js app settings)
   - Update `.env.production` or environment variables with the correct port

## Step 7: Start the Application

1. In cPanel Node.js app settings, click **"Restart"** or **"Start"**
2. Wait for the application to start
3. Check the logs for any errors

## Step 8: Configure Domain and SSL

1. **Point Domain to Application:**
   - In cPanel, go to **Domains** or **Subdomains**
   - Ensure `gms.hostado.net` points to your application directory

2. **Set Up SSL Certificate:**
   - Go to **SSL/TLS Status** in cPanel
   - Install a free Let's Encrypt certificate for `gms.hostado.net`
   - Force HTTPS redirect

## Step 9: Verify Deployment

1. Visit `https://gms.hostado.net` in your browser
2. Verify:
   - Application loads correctly
   - Login works
   - No console errors
   - HTTPS is working

3. **Test Search Engine Blocking:**
   - Visit `https://gms.hostado.net/robots.txt`
   - Should show: `User-agent: * Disallow: /`
   - Check page source for `noindex` meta tags

## Step 10: Set Up Cron Jobs (Optional)

If you need to run scheduled tasks (email checking, reminders, etc.):

1. In cPanel, go to **Cron Jobs**
2. Add cron jobs for:
   - Email checking: `curl https://gms.hostado.net/api/cron/check-emails?secret=YOUR_CRON_SECRET`
   - Overdue reminders: `curl https://gms.hostado.net/api/cron/check-overdue-reminders?secret=YOUR_CRON_SECRET`
   - Tag removals: `curl https://gms.hostado.net/api/cron/check-tag-removals?secret=YOUR_CRON_SECRET`

   Set frequency as needed (e.g., every 15 minutes, daily, etc.)

## Troubleshooting

### Application Won't Start

1. Check Node.js version (must be 18+)
2. Verify all environment variables are set
3. Check application logs in cPanel
4. Ensure `npm run build` completed successfully
5. Verify port is correct

### 404 Errors

1. Check `.htaccess` file is uploaded
2. Verify Next.js routing is working
3. Check file permissions

### Database Connection Issues

1. Verify Supabase URL and keys are correct
2. Check Supabase project is active
3. Verify RLS policies are set up correctly

### Build Errors

1. Ensure Node.js version is 18+
2. Run `npm install` again
3. Clear `.next` folder and rebuild
4. Check for TypeScript errors: `npm run lint`

## Maintenance

### Updating the Application

1. Upload new files (excluding `node_modules` and `.next`)
2. SSH into server
3. Run:
   ```bash
   cd ~/gms.hostado.net
   npm install --production
   npm run build
   ```
4. Restart the Node.js application in cPanel

### Monitoring

- Check application logs regularly in cPanel
- Monitor Supabase dashboard for database usage
- Set up uptime monitoring if available

## Security Notes

- ✅ Application is configured to NOT be indexed by search engines
- ✅ HTTPS should be enforced
- ✅ Environment variables are not exposed to client
- ✅ RLS policies protect database access
- ⚠️ Keep dependencies updated: `npm audit` and `npm update`

## Support

If you encounter issues:
1. Check cPanel error logs
2. Check Next.js application logs
3. Verify Supabase connection
4. Review this deployment guide





