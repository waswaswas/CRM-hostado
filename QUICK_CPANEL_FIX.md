# Quick cPanel Fix Guide

## Immediate Actions Required

### 1. Set Environment Variables in cPanel

In your cPanel Node.js application settings, add/update these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=https://gms.hostado.net
NODE_ENV=production
PORT=3000
```

**Important**: Replace `your-project.supabase.co` and `your-anon-key-here` with your actual Supabase values.

### 2. Configure Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to: `https://gms.hostado.net`
5. In **Redirect URLs**, add:
   ```
   https://gms.hostado.net/**
   https://gms.hostado.net/auth/callback
   https://gms.hostado.net/auth/reset-password
   ```
6. Click **Save**

### 3. Restart Application

After setting environment variables:
1. Go to cPanel → Node.js application
2. Click **Restart** or **Reload**

## What Was Fixed

✅ **Server Components Error**: Improved error handling to prevent crashes when environment variables are missing

✅ **Password Reset Redirect**: Added `NEXT_PUBLIC_APP_URL` environment variable support and improved redirect handling

✅ **Server Startup**: Fixed `server.js` to properly handle errors and startup

## Testing

After making changes:
1. Visit `https://gms.hostado.net`
2. Try logging in
3. Test password reset (if available)
4. Verify no errors appear in browser console

## Still Having Issues?

1. Check cPanel error logs
2. Verify all environment variables are set correctly
3. Ensure Supabase Site URL matches your domain
4. Clear browser cache and try again


