# cPanel Deployment Fixes

## Issues Fixed

### 1. Server Components Error
**Problem**: Error "An error occurred in the Server Components render" after deployment.

**Solution**: 
- Improved error handling in `lib/supabase/server.ts` to prevent crashes when environment variables are missing
- Fixed `server.js` to properly handle errors and server startup

**Action Required**:
1. Make sure all environment variables are set in cPanel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (NEW - set to `https://gms.hostado.net`)
   - `NODE_ENV=production`

### 2. Password Reset Redirects to localhost
**Problem**: Password reset emails redirect to `localhost:3000` instead of production domain.

**Solutions**:

#### A. Set Environment Variable in cPanel
1. In cPanel, go to your Node.js application settings
2. Add environment variable:
   ```
   NEXT_PUBLIC_APP_URL=https://gms.hostado.net
   ```
3. Restart your Node.js application

#### B. Configure Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Set **Site URL** to: `https://gms.hostado.net`
4. Add to **Redirect URLs**:
   - `https://gms.hostado.net/auth/reset-password`
   - `https://gms.hostado.net/auth/callback`
   - `https://gms.hostado.net/**` (wildcard for all routes)
5. Save changes

#### C. Verify Environment Variables
After setting environment variables in cPanel, verify they're loaded:
1. SSH into your cPanel account (if available)
2. Navigate to your application directory
3. Check if `.env.production` exists and contains:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=https://gms.hostado.net
   NODE_ENV=production
   ```

## Quick Fix Checklist

- [ ] Set `NEXT_PUBLIC_APP_URL=https://gms.hostado.net` in cPanel environment variables
- [ ] Restart Node.js application in cPanel
- [ ] Update Supabase Site URL to `https://gms.hostado.net`
- [ ] Add redirect URLs in Supabase dashboard
- [ ] Verify all environment variables are set correctly
- [ ] Test password reset flow

## Testing Password Reset

1. Go to login page
2. Click "Forgot Password" (if available) or use Supabase's built-in reset
3. Check email for reset link
4. Verify the link points to `https://gms.hostado.net` not `localhost`

## Additional Notes

- The `NEXT_PUBLIC_APP_URL` environment variable is now used for all email redirects
- If you don't set `NEXT_PUBLIC_APP_URL`, the system will try to detect it automatically, but it's better to set it explicitly
- After making changes, always restart your Node.js application in cPanel

## Troubleshooting

If password reset still redirects to localhost:
1. Clear browser cache
2. Check Supabase dashboard redirect URLs again
3. Verify `NEXT_PUBLIC_APP_URL` is set correctly
4. Check cPanel error logs for any environment variable issues
5. Restart the Node.js application


