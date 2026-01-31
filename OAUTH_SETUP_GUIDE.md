# Google OAuth Setup Guide

## Current Status
⚠️ **Google OAuth credentials are not configured**. Users cannot log in until this is set up.

## Quick Setup Steps

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "AutoMatrix ERP" (or your preferred name)
4. Click "Create"

### 2. Enable Google+ API
1. In the project, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: Internal (for organization) or External (for public)
   - App name: AutoMatrix ERP
   - User support email: Your email
   - Developer contact: Your email
   - Save and continue
4. Back to "Create OAuth client ID":
   - Application type: **Web application**
   - Name: AutoMatrix ERP Web Client
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://yourdomain.com` (add production URL later)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://yourdomain.com/api/auth/callback/google` (add production URL later)
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### 4. Update Environment Variables
1. Open `.env.local` file
2. Update the values:
   ```bash
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-actual-client-secret
   ```
3. Save the file
4. Restart your dev server: `pnpm dev`

### 5. Verify Setup
Run the security check:
```bash
pnpm security:check
```

It should pass without errors.

### 6. Test Login
1. Go to `http://localhost:3000/login`
2. Click "Sign in with Google"
3. You should be redirected to Google's login page
4. After login, you should be redirected back to the dashboard

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Solution:** Make sure the redirect URI in Google Console exactly matches:
```
http://localhost:3000/api/auth/callback/google
```

### Error: "Access blocked: This app's request is invalid"
**Solution:** 
- Check that Google+ API is enabled
- Verify OAuth consent screen is configured
- Make sure the client ID and secret are correct

### Still getting "Sign in" errors?
**Check:**
1. `.env.local` has the correct credentials (no extra spaces)
2. Next.js dev server was restarted after updating `.env.local`
3. Browser cookies are cleared
4. NEXTAUTH_SECRET is set and valid

## Production Deployment

Before deploying to production:

1. Add production URLs to Google Console:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`

2. Update production environment variables:
   ```bash
   NEXTAUTH_URL=https://yourdomain.com
   GOOGLE_CLIENT_ID=same-as-development
   GOOGLE_CLIENT_SECRET=same-as-development
   NEXTAUTH_SECRET=generate-new-secret-for-production
   ```

3. Consider OAuth consent screen verification if using "External" user type

## Security Notes

- ✅ Never commit `.env.local` or `.env` files to version control
- ✅ Use different `NEXTAUTH_SECRET` for production
- ✅ Restrict OAuth client to specific domains in production
- ✅ Regularly rotate secrets
- ✅ Monitor OAuth usage in Google Console

## Alternative: Skip OAuth for Development

If you want to test without OAuth temporarily, you can:

1. Comment out the Google provider in `src/lib/auth.ts`
2. Use email/password authentication (already implemented)
3. Register a user via `/api/register`

**Note:** This is not recommended for production.
