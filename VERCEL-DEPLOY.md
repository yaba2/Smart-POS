# Vercel Deployment Guide

## Environment Variables to Set in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables, and add these:

### Required Variables

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Your Neon connection string | `postgresql://neondb_owner:xxx@ep-xxxxx-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | A secure random string (32+ chars) | `your-super-secret-key-min-32-chars-long` |
| `NEXTAUTH_URL` | Your Vercel deployment URL | `https://moonlight.vercel.app` |

### Important Notes

1. **NEXTAUTH_URL**: Must match your actual Vercel domain exactly
   - Production: `https://moonlight.vercel.app`
   - If using custom domain: `https://yourdomain.com`

2. **DATABASE_URL**: Neon connection string must include:
   - `sslmode=require` (already in your string ✓)
   - Use the **pooler** endpoint (ends with `-pooler`) for serverless

3. **SESSION_SECRET**: Generate a new secure one for production:
   ```bash
   openssl rand -base64 32
   ```

## Deployment Steps

1. **Push to GitHub** (already done)
2. **Import in Vercel**:
   - Go to https://vercel.com/new
   - Import your `yaba2/MoonLight` repo
   - Framework: Next.js
   - Root directory: `./`
3. **Add Environment Variables** (see table above)
4. **Deploy**

## Post-Deployment

After first deploy, run database migrations:
```bash
npx prisma migrate deploy
```

Or add this to your Vercel build command:
```bash
prisma migrate deploy && next build
```

## Build Settings

In Vercel project settings, set:
- **Build Command**: `prisma generate && prisma migrate deploy && next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## Troubleshooting

- **DB connection errors**: Check DATABASE_URL has `sslmode=require`
- **Session issues**: Ensure SESSION_SECRET is set and NEXTAUTH_URL matches your domain
- **Build fails**: Add `prisma generate` before build step
