# Deploy Tiered Pricing App to Vercel + Neon (Free Forever)

Complete step-by-step guide to deploy your Shopify Remix app to **Vercel** (hosting) + **Neon** (PostgreSQL database) with **permanent free tier**.

---

## Why Vercel + Neon?

- **Permanent free tier** (never expires)
- No credit card required for either platform
- Excellent performance
- Generous limits:
  - Neon: 0.5 GB storage, 100 compute hours/month
  - Vercel: 100 GB bandwidth/month, 6,000 build minutes/month
- Automatic scaling to zero (saves resources)

---

## Prerequisites

1. GitHub/GitLab/Bitbucket account (to connect your repo)
2. Shopify Partner account with app created
3. Your app code pushed to a Git repository

---

## Part 1: Set Up Neon PostgreSQL Database

### Step 1: Create Neon Account

1. Go to https://neon.tech
2. Click **Sign Up** (no credit card required)
3. Sign up with GitHub, Google, or email

### Step 2: Create Database Project

1. After login, you'll be on the **Projects** page
2. Click **Create a project** (or use the default project created for you)
3. Project settings:
   - **Name**: `tiered-pricing`
   - **Region**: **US East (Ohio)** (closest to Vercel's US regions)
   - **Postgres version**: **17** (latest)
   - **Compute size**: Leave default (will auto-scale)
4. Click **Create project**

### Step 3: Get Database Connection String

1. On the project dashboard, you'll see **Connection Details**
2. Click **Connection string** dropdown
3. Select **Pooled connection** (recommended for Prisma)
4. Copy the connection string - it looks like:
   ```
   postgresql://username:password@ep-xxx-xxx-123.us-east-2.aws.neon.tech/tiered_pricing?sslmode=require
   ```
5. **Save this connection string** - you'll need it for Vercel

**Important**: Neon connection strings include the password. Keep it secure!

### Step 4: Verify Database is Ready

1. In Neon dashboard, go to **Tables** tab
2. You should see an empty database (no tables yet)
3. Tables will be created automatically when Vercel runs Prisma migrations

---

## Part 2: Deploy to Vercel

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click **Sign Up**
3. **Sign up with the same Git provider** where your code is hosted (GitHub/GitLab/Bitbucket)
4. Authorize Vercel to access your repositories

### Step 2: Import Your Project

1. On Vercel dashboard, click **Add New** → **Project**
2. You'll see a list of your Git repositories
3. Find `tiered-pricing` repository
4. Click **Import**

### Step 3: Configure Project Settings

1. **Framework Preset**: Vercel should auto-detect **Remix**
2. **Root Directory**: `.` (leave as default, unless your app is in a subdirectory)
3. **Build Command**: `npm run build` (auto-detected from package.json)
4. **Output Directory**: Leave empty (Remix handles this)
5. **Install Command**: `npm install` (auto-detected)

### Step 4: Add Environment Variables

Click **Environment Variables** section and add the following:

#### Required Variables:

| Name | Value | Where to get it |
|------|-------|----------------|
| `DATABASE_URL` | `postgresql://...` | Paste the Neon connection string from Part 1, Step 3 |
| `SHOPIFY_API_KEY` | Your Shopify API key | Shopify Partners → Apps → [Your App] → Client ID |
| `SHOPIFY_API_SECRET` | Your Shopify API secret | Shopify Partners → Apps → [Your App] → Client secret |
| `SHOPIFY_APP_URL` | `https://YOUR_APP_NAME.vercel.app` | Will be available after first deploy (use placeholder for now) |
| `SCOPES` | `read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders` | Copy exactly as shown |
| `NODE_ENV` | `production` | Literal value |

**Important**: After first deployment, you'll get the actual Vercel URL. Come back and update `SHOPIFY_APP_URL` with the real URL.

### Step 5: Deploy

1. Click **Deploy**
2. Vercel will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Generate Prisma Client (`postinstall` script)
   - Build your Remix app (`npm run build`)
   - Deploy to edge network

**First deployment takes 2-5 minutes.**

### Step 6: Monitor Build Logs

1. You'll see a **Building** screen with live logs
2. Watch for these key steps:
   ```
   ✓ Cloning repository
   ✓ Running "npm install"
   ✓ Running "prisma generate"
   ✓ Running "npm run build"
   ✓ Build completed
   ✓ Deploying
   ```
3. If successful, you'll see: **Your project has been deployed!**
4. Copy your deployment URL: `https://your-app-name.vercel.app`

### Step 7: Run Database Migrations

**Important**: Vercel doesn't automatically run Prisma migrations. You need to run them manually once.

#### Option A: Run Locally (Recommended)

1. Open terminal on your local machine
2. Set the Neon database URL:
   ```bash
   export DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/tiered_pricing?sslmode=require"
   ```
3. Run migrations:
   ```bash
   cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"
   npx prisma migrate deploy
   ```
4. You should see:
   ```
   Applying migration `20240101000000_init`
   Applying migration `20240102000000_add_shopify_discount_id`
   ✓ Database is now in sync with schema
   ```

#### Option B: Add Migration to Build Script (Automated)

Add this to [package.json](package.json) `build` script:
```json
"build": "prisma migrate deploy && prisma generate && remix vite:build"
```

**Warning**: This runs migrations on every deploy, which can be slow. Use Option A for first deployment.

### Step 8: Update SHOPIFY_APP_URL

1. Copy your Vercel URL from Step 6 (e.g., `https://tiered-pricing-xyz.vercel.app`)
2. Go to Vercel dashboard → Your Project → **Settings** → **Environment Variables**
3. Find `SHOPIFY_APP_URL`
4. Click **Edit** and update with your actual Vercel URL
5. Click **Save**
6. **Redeploy**: Go to **Deployments** tab → Click `...` on latest deployment → **Redeploy**

---

## Part 3: Update Shopify App Configuration

### Step 1: Update shopify.app.toml

1. Open [shopify.app.toml](shopify.app.toml) in your local code editor
2. Update these fields:
   ```toml
   application_url = "https://YOUR_VERCEL_URL.vercel.app"

   [auth]
   redirect_urls = [
     "https://YOUR_VERCEL_URL.vercel.app/api/auth",
     "https://YOUR_VERCEL_URL.vercel.app/api/auth/callback",
     "https://YOUR_VERCEL_URL.vercel.app/auth/callback"
   ]
   ```
3. Replace `YOUR_VERCEL_URL` with your actual Vercel domain

### Step 2: Deploy Configuration to Shopify

1. Open terminal in your project directory
2. Run:
   ```bash
   cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"
   shopify app deploy
   ```
3. This updates your Shopify Partners app configuration

### Step 3: Verify in Shopify Partners Dashboard

1. Go to https://partners.shopify.com
2. Navigate to **Apps** → **[Your App Name]**
3. Go to **Configuration** → **URLs**
4. Verify:
   - **App URL**: `https://your-vercel-url.vercel.app`
   - **Allowed redirection URLs**: Should include your Vercel URLs

---

## Part 4: Test Your Deployment

### Step 1: Install App on Dev Store

1. Go to Shopify Partners → Apps → [Your App]
2. Click **Select store** → Choose your dev store
3. Click **Install app**
4. You'll be redirected to your Vercel URL
5. Complete OAuth flow

### Step 2: Test Core Functionality

1. **Create a tier rule**:
   - Go to your app dashboard
   - Click **Create tier**
   - Add products/collections
   - Add tier levels
   - Save

2. **Verify discount in Shopify**:
   - Go to your Shopify admin → **Discounts**
   - You should see the automatic discount created

3. **Test in storefront**:
   - Add qualifying products to cart
   - Verify discount applies at checkout

### Step 3: Check Database

1. Go to Neon dashboard → Your project → **Tables**
2. You should see:
   - `TierRule` table with your test rule
   - `TierLevel` table with tier levels
   - `Session` table with OAuth session
   - `AppSettings` table

---

## Part 5: Monitoring and Maintenance

### Monitor Vercel Deployments

1. **View Logs**: Vercel dashboard → Your Project → **Deployments** → Click deployment → **View Function Logs**
2. **Analytics**: Vercel dashboard → Your Project → **Analytics** (usage, response times)
3. **Set up alerts**: Settings → Notifications

### Monitor Neon Database

1. **Check usage**: Neon dashboard → Your Project → **Usage**
   - Storage used (max 0.5 GB on free tier)
   - Compute hours (max 100 hours/month)
2. **Monitoring**: **Monitoring** tab shows query performance
3. **Branches**: Neon allows database branches (like Git) for testing

### Automatic Deployments

Vercel automatically redeploys when you push to your Git repository:
1. Make code changes locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update feature X"
   git push origin main
   ```
3. Vercel detects the push and redeploys automatically

---

## Troubleshooting

### Issue: "Module not found: Can't resolve 'pg'"

**Cause**: Vercel doesn't bundle native Node modules by default.

**Fix**: Already applied in [vite.config.ts](vite.config.ts:71-73):
```typescript
ssr: {
  noExternal: ["@prisma/client", ".prisma/client"],
}
```

### Issue: "Prisma Client not generated"

**Cause**: `prisma generate` didn't run during build.

**Fix**: Already applied in [package.json](package.json:6):
```json
"postinstall": "prisma generate"
```

### Issue: Database connection refused

**Cause**: Wrong connection string or missing `sslmode=require`.

**Fix**: Ensure your `DATABASE_URL` ends with `?sslmode=require`.

### Issue: "Too many connections"

**Cause**: Vercel serverless functions create many database connections.

**Fix**: Use Neon's **pooled connection string**:
1. Neon dashboard → Connection Details → **Pooled connection**
2. Update `DATABASE_URL` in Vercel with the pooled URL

### Issue: Neon compute hours exceeded

**Symptom**: Database stops responding, error "compute hours exhausted".

**Fix**:
- Free tier: 100 compute hours/month
- Neon auto-scales to zero when idle (5 min timeout)
- Check usage: Neon dashboard → Usage
- If exceeded, upgrade to paid plan or wait for monthly reset

### Issue: Build fails with "Out of memory"

**Cause**: Vercel free tier has 1 GB build memory limit.

**Fix**: Optimize build:
```json
// package.json
"build": "NODE_OPTIONS='--max-old-space-size=1024' prisma generate && remix vite:build"
```

### Issue: OAuth redirect fails

**Cause**: Redirect URLs not configured correctly.

**Fix**:
1. Verify `SHOPIFY_APP_URL` in Vercel matches your actual Vercel URL
2. Run `shopify app deploy` to sync configuration
3. Check Shopify Partners → App → Configuration → URLs

---

## Cost Breakdown (Free Tier)

| Service | Free Tier | Monthly Cost |
|---------|-----------|--------------|
| **Neon PostgreSQL** | 0.5 GB storage, 100 compute hours | **$0** (permanent) |
| **Vercel Hosting** | 100 GB bandwidth, 6,000 build minutes | **$0** (permanent) |
| **Total** | | **$0/month** |

### When to Upgrade

**Neon** (upgrade at $19/month):
- Storage > 0.5 GB
- Compute hours > 100/month
- Need more than 1 project
- Need point-in-time recovery > 7 days

**Vercel** (upgrade at $20/month):
- Bandwidth > 100 GB/month
- Need custom domains with SSL
- Team collaboration features
- Advanced analytics

---

## Next Steps After Deployment

1. **Test thoroughly** on your dev store
2. **Fill out App Listing**:
   - Shopify Partners → Apps → [Your App] → **App Listing**
   - Upload app icon (512x512 PNG)
   - Add description, screenshots
   - Add privacy policy URL
   - Set support email
3. **Submit for Shopify review**:
   - Shopify Partners → Apps → [Your App] → **Submit**
   - Review can take 3-5 business days
4. **Monitor production**:
   - Set up error tracking (e.g., Sentry)
   - Monitor Vercel logs regularly
   - Check Neon usage weekly

---

## Useful Commands

```bash
# Deploy configuration to Shopify
shopify app deploy

# Run database migrations locally
npx prisma migrate deploy

# View Prisma Studio (database GUI)
npx prisma studio

# Check database schema
npx prisma db pull

# Generate new migration
npx prisma migrate dev --name your_migration_name

# Vercel CLI (optional)
npm i -g vercel
vercel login
vercel --prod  # Deploy from CLI
```

---

## Resources

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Remix on Vercel: https://vercel.com/docs/frameworks/remix
- Shopify App Remix: https://shopify.dev/docs/api/shopify-app-remix

---

**Congratulations!** Your Shopify app is now deployed to production with a permanent free tier.
