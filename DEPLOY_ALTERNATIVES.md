# Free Deployment Alternatives for Tiered Pricing App

Since Fly.io now requires credit card verification/credits, here are the **best free alternatives** for deploying your Shopify Remix app with PostgreSQL in 2025.

---

## Option 1: Render.com (RECOMMENDED for simplicity)

**Best for:** All-in-one deployment with built-in PostgreSQL

### Pros
- True free tier (no credit card required initially)
- Native PostgreSQL support
- Docker support (uses your existing Dockerfile)
- HTTPS included
- Easy setup (similar to Fly.io)
- Background workers and cron jobs supported

### Cons
- Free PostgreSQL expires after **30 days** (reduced from 90 days in May 2024)
- Free web services spin down after 15 minutes of inactivity (cold starts)
- Limited to 1 free database per account

### Free Tier Limits
- **Web Service**: 0.1 CPU, 512 MB RAM, spin down after 15 min inactivity
- **PostgreSQL**: 1 GB storage, **expires after 30 days**, no backups
- **Bandwidth**: 100 GB/month

### Deployment Steps

#### 1. Create Render Account
```bash
# Go to https://render.com and sign up
```

#### 2. Create PostgreSQL Database

1. Dashboard → **New** → **PostgreSQL**
2. Settings:
   - **Name**: `tiered-pricing-db`
   - **Database**: `tiered_pricing`
   - **User**: (auto-generated)
   - **Region**: Oregon (US West)
   - **Instance Type**: **Free**
3. Click **Create Database**
4. **Copy the Internal Database URL** (starts with `postgres://...`)

#### 3. Create Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo (or use "Public Git Repository")
3. Settings:
   - **Name**: `tiered-pricing`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Runtime**: **Docker**
   - **Instance Type**: **Free**
4. **Environment Variables** (click "Advanced"):
   ```
   DATABASE_URL=<paste Internal Database URL from step 2>
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   SHOPIFY_APP_URL=https://tiered-pricing.onrender.com
   SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders
   NODE_ENV=production
   ```
5. Click **Create Web Service**

#### 4. Update Shopify App URLs

Once deployed, your app will be at `https://tiered-pricing.onrender.com`

Edit [shopify.app.toml](shopify.app.toml):
```toml
application_url = "https://tiered-pricing.onrender.com"

[auth]
redirect_urls = [ "https://tiered-pricing.onrender.com/api/auth" ]
```

Then deploy config:
```bash
shopify app deploy
```

#### 5. Watch Deployment Logs

Render will:
1. Build Docker image from your `Dockerfile`
2. Run `npm run docker-start` (which runs Prisma migrations)
3. Start the Remix server

**Important:** First request after 15 min will take 30-60 seconds (cold start).

### Cost: **$0/month** for first 30 days, then you must either:
- Delete and recreate database every 30 days (loses all data)
- Upgrade to paid PostgreSQL ($7/month)

---

## Option 2: Vercel + Neon (RECOMMENDED for permanent free tier)

**Best for:** Permanent free tier with no expiration

### Pros
- **Permanent free tier** (Neon PostgreSQL never expires)
- Excellent performance (Vercel's edge network)
- No cold starts for frontend
- Generous free limits (Neon: 0.5 GB storage, 100 compute hours/month)
- Scales to zero automatically

### Cons
- Requires external database (Neon)
- More setup steps (two platforms)
- Vercel optimized for frontend/serverless (Remix works but not ideal for long-running servers)

### Free Tier Limits
- **Vercel**: 100 GB bandwidth/month, 6,000 minutes build time/month
- **Neon**: 0.5 GB storage, 100 compute hours/month, auto-scales to zero

### Deployment Steps

#### 1. Create Neon Database

1. Go to https://neon.tech and sign up (no credit card required)
2. Create new project:
   - **Name**: `tiered-pricing`
   - **Region**: US East (Ohio)
   - **Postgres version**: 17
3. **Copy the connection string** (click "Connection Details")
   ```
   postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/tiered_pricing?sslmode=require
   ```

#### 2. Deploy to Vercel

1. Go to https://vercel.com and sign up
2. Import your Git repository (GitHub/GitLab/Bitbucket)
3. **Framework Preset**: Remix
4. **Environment Variables**:
   ```
   DATABASE_URL=<paste Neon connection string>
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   SHOPIFY_APP_URL=https://tiered-pricing.vercel.app
   SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders
   NODE_ENV=production
   ```
5. **Build Command**: `npm run build`
6. **Output Directory**: `build/client`
7. Click **Deploy**

#### 3. Run Database Migrations

Since Vercel deploys are serverless, you need to run migrations manually:

```bash
# Set DATABASE_URL locally
export DATABASE_URL="<your Neon connection string>"

# Run migrations
npx prisma migrate deploy
```

Alternatively, add this to your `package.json` build script:
```json
"scripts": {
  "build": "prisma migrate deploy && remix vite:build"
}
```

#### 4. Update Shopify App URLs

Your app will be at `https://tiered-pricing.vercel.app` (or custom domain)

Update [shopify.app.toml](shopify.app.toml) and run `shopify app deploy`.

### Cost: **$0/month permanently** (both Vercel and Neon have never-expiring free tiers)

---

## Option 3: Railway (Trial Only)

**Best for:** Testing deployment before committing to a platform

### Pros
- Easiest setup (similar to Fly.io)
- Native PostgreSQL support
- No cold starts (always running)
- Docker support

### Cons
- **No permanent free tier** (30-day trial with $5 credit)
- After trial: minimum **$5/month**
- Limited to 1 GB RAM during trial

### Free Trial
- **Duration**: 30 days
- **Credits**: $5 (then $1/month, but not enough for app + database)
- **After trial**: Requires minimum $5/month subscription

### Deployment Steps

Similar to Fly.io deployment:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Create PostgreSQL
railway add postgresql

# Deploy
railway up

# Set environment variables
railway variables set SHOPIFY_API_KEY=your_key
railway variables set SHOPIFY_API_SECRET=your_secret
railway variables set SHOPIFY_APP_URL=https://tiered-pricing.up.railway.app
railway variables set SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders
```

### Cost: **$0 for 30 days**, then **$5/month minimum**

---

## Comparison Table

| Platform | Free Tier Duration | PostgreSQL | Cold Starts | Setup Difficulty | Best For |
|---|---|---|---|---|---|
| **Render** | 30 days (DB expires) | Built-in (1 GB) | Yes (15 min) | Easy | Short-term testing |
| **Vercel + Neon** | **Permanent** | External (0.5 GB) | No (frontend only) | Medium | **Long-term production** |
| **Railway** | 30 days trial | Built-in | No | Easy | Quick testing |
| **Fly.io** | N/A (requires credits) | Built-in | No | Easy | N/A (not free) |

---

## Recommended Choice

### For Production (App Store submission):
**Vercel + Neon** — Permanent free tier, no database expiration, scales to zero automatically.

### For Quick Testing:
**Render** — Easiest all-in-one setup, but database expires after 30 days.

---

## Next Steps After Choosing a Platform

1. Deploy your app to chosen platform
2. Update `shopify.app.toml` with production URL
3. Run `shopify app deploy` to sync configuration
4. Test OAuth flow in your dev store
5. Fill out app listing in Partners dashboard:
   - App icon (512x512 PNG)
   - Description and screenshots
   - Privacy policy URL
   - Support email
6. Submit for Shopify App Store review

---

## Troubleshooting

### Vercel deployment fails
- **Error**: `Module not found: Can't resolve 'pg'`
- **Fix**: Vercel doesn't bundle native modules by default. Add to `vite.config.ts`:
  ```typescript
  export default defineConfig({
    ssr: {
      noExternal: ['@prisma/client', '.prisma/client'],
    },
  });
  ```

### Render cold starts taking too long
- **Solution**: Upgrade to paid tier ($7/month for always-on instance)
- **Or**: Accept 30-60 second delay on first request after 15 min inactivity

### Neon compute hours exceeded
- **Check usage**: Neon dashboard → Usage
- **Solution**: Ensure `scale-to-zero` is enabled (default on free tier)
- **Tip**: Free tier includes 100 compute hours/month (enough for ~4 hours/day at 1 CU)

### Database connection pooling issues
- **Prisma with Neon**: Use `?pgbouncer=true` in connection string for pooling
- **Example**: `postgres://user:pass@host/db?sslmode=require&pgbouncer=true`

---

**Need help?**
- Render docs: https://render.com/docs
- Neon docs: https://neon.com/docs
- Vercel docs: https://vercel.com/docs
