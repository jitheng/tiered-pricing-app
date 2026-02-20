# Fly.io Deployment Guide — Tiered Pricing App

**Before you start:**
- Install flyctl: `brew install flyctl`
- Sign up/login: `fly auth login`
- Have your Shopify API credentials ready (from Partners dashboard)

---

## Step 1: Launch the App (creates the main app container)

```bash
cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"

# Launch creates the app from your Dockerfile
fly launch --name tiered-pricing --region iad --no-deploy
```

**What this does:**
- Creates a Fly app named `tiered-pricing`
- Detects the existing `Dockerfile`
- Detects the existing `fly.toml`
- Asks you to confirm the region (iad = US East)
- **Does NOT deploy yet** (`--no-deploy` flag)

**Answer the prompts:**
- `? Would you like to set up a PostgreSQL database now?` → **NO** (we'll do it manually next)
- `? Would you like to set up an Upstash Redis database now?` → **NO**
- `? Create .dockerignore from 3 .gitignore files?` → **YES**

---

## Step 2: Create PostgreSQL Database

```bash
# Create a Postgres cluster (separate app)
fly postgres create \
  --name tiered-pricing-db \
  --region iad \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
```

**Answer the prompts:**
- `? Select configuration:` → Choose **Development - Single node, 1x shared CPU, 256MB RAM, 1GB disk**
- `? Would you like to set up an Upstash Redis database now?` → **NO**

This creates a Postgres app/cluster with:
- **Free tier**: shared-cpu-1x, 256MB RAM, 1GB storage
- **1 node** (no HA replicas — fine for development)

**Wait for it to finish** — you'll see:
```
Postgres cluster tiered-pricing-db created
  Username:    postgres
  Password:    <random_password>
  Hostname:    tiered-pricing-db.internal
  Flycast:     fdaa:9:a264:0:1::3
  Proxy port:  5432
  Postgres port:  5433
  Connection string: postgres://postgres:<password>@tiered-pricing-db.flycast:5432
```

**Save the password** shown in the output — you won't see it again.

---

## Step 3: Attach Database to App

```bash
# Connect the database to your app
fly postgres attach tiered-pricing-db --app tiered-pricing
```

**What this does:**
- Links the Postgres cluster to your app
- Auto-creates a `DATABASE_URL` secret with the full connection string
- Grants your app network access to the DB

You should see:
```
Postgres cluster tiered-pricing-db is now attached to tiered-pricing
The following secret was added to tiered-pricing:
  DATABASE_URL=postgres://...
```

---

## Step 4: Set Shopify Secrets

```bash
# Set all required environment variables
fly secrets set \
  SHOPIFY_API_KEY=your_shopify_api_key_here \
  SHOPIFY_API_SECRET=your_shopify_api_secret_here \
  SHOPIFY_APP_URL=https://tiered-pricing.fly.dev \
  SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders \
  --app tiered-pricing
```

**Get your credentials:**
1. Go to https://partners.shopify.com
2. Apps → Your App → Configuration
3. Copy **Client ID** → use as `SHOPIFY_API_KEY`
4. Copy **Client secret** → use as `SHOPIFY_API_SECRET`

**Important:** Replace the placeholder values with your actual credentials.

---

## Step 5: Deploy the App

```bash
# Deploy to Fly
fly deploy
```

**What happens during deploy:**
1. Builds Docker image from `Dockerfile`
2. Uploads to Fly's registry
3. Starts the container
4. Runs `npm run docker-start` which:
   - Executes `prisma migrate deploy` (creates DB tables)
   - Starts the Remix server with `remix-serve`

**Watch the logs:**
```bash
fly logs --app tiered-pricing
```

You should see:
```
✔ Generated Prisma Client
✔ Applied migration 20260218085938_init
✔ Applied migration 20260218114057_add_shopify_discount_id
Server listening on http://localhost:3000
```

---

## Step 6: Update Shopify App URLs

Now that your app is live at `https://tiered-pricing.fly.dev`, update the Shopify configuration:

### Option A: Via Shopify CLI (recommended)

1. Edit `shopify.app.toml`:
   ```toml
   application_url = "https://tiered-pricing.fly.dev"

   [auth]
   redirect_urls = [ "https://tiered-pricing.fly.dev/api/auth" ]
   ```

2. Deploy config to Partners:
   ```bash
   shopify app deploy
   ```

### Option B: Via Partners Dashboard

1. Go to https://partners.shopify.com → Apps → Tiered Pricing
2. **App setup** → **URLs**:
   - App URL: `https://tiered-pricing.fly.dev`
   - Allowed redirection URL(s): `https://tiered-pricing.fly.dev/api/auth`
3. Click **Save**

---

## Step 7: Test the App

```bash
# Open your app URL
fly open --app tiered-pricing
```

This opens `https://tiered-pricing.fly.dev` in your browser.

**You should see:**
- A login page asking for your shop domain
- OR a redirect to Shopify auth (if you access through Shopify Admin)

**To access the embedded app:**
1. Go to your dev store's Shopify Admin
2. Apps → Tiered Pricing
3. The app should load embedded in the admin

---

## Troubleshooting

### Database connection fails

**Check if DATABASE_URL is set:**
```bash
fly secrets list --app tiered-pricing
```

You should see `DATABASE_URL` in the list. If missing:
```bash
fly postgres attach tiered-pricing-db --app tiered-pricing
```

### Postgres cluster doesn't exist

**List all postgres apps:**
```bash
fly postgres list
```

If `tiered-pricing-db` is missing, recreate it:
```bash
fly postgres create --name tiered-pricing-db --region iad
```

### App crashes on startup

**View logs:**
```bash
fly logs --app tiered-pricing
```

Common issues:
- **Prisma migration fails**: Missing `DATABASE_URL` → attach database
- **Build fails**: Node version mismatch → check `Dockerfile` uses `node:20-alpine`
- **Port mismatch**: App listens on wrong port → check `fly.toml` has `internal_port = 3000`

### Can't reach the app

**Check app status:**
```bash
fly status --app tiered-pricing
```

Should show:
```
Instances
ID       VERSION  REGION  STATE   HEALTH CHECKS  RESTARTS  CREATED
abc123   12       iad     running 1 total         0         1m ago
```

If `STATE` is `stopped` or `crashed`:
```bash
fly logs --app tiered-pricing  # check logs
fly apps restart tiered-pricing  # restart
```

---

## Useful Commands

```bash
# SSH into the container
fly ssh console --app tiered-pricing

# Run migrations manually
fly ssh console --app tiered-pricing -C "npm run setup"

# View environment variables
fly secrets list --app tiered-pricing

# Scale to zero (pause billing)
fly scale count 0 --app tiered-pricing

# Scale back up
fly scale count 1 --app tiered-pricing

# Destroy everything (careful!)
fly apps destroy tiered-pricing
fly postgres destroy tiered-pricing-db
```

---

## Cost Breakdown (Free Tier)

| Resource | Free Tier Limit | Used |
|---|---|---|
| **Compute** | 3 shared-cpu-1x VMs (256MB RAM each) | 1 VM |
| **Postgres** | 3GB total storage across all DBs | 1GB |
| **Bandwidth** | 160GB/month | ~1GB typical |

**Total cost: $0/month** if you stay within free tier limits.

If you exceed free tier:
- Additional VMs: $1.94/month per shared-cpu-1x
- Additional storage: $0.15/GB/month

---

## Production Checklist

Before going to production:

- [ ] Switch to a paid plan (free tier has lower uptime guarantees)
- [ ] Add `HA` (High Availability) Postgres replicas: `fly postgres attach --app tiered-pricing tiered-pricing-db --replica`
- [ ] Scale to 2+ VMs for redundancy: `fly scale count 2`
- [ ] Set up monitoring: `fly logs` → forward to logging service
- [ ] Add custom domain: `fly certs add tiered-pricing.yourdomain.com`
- [ ] Enable backups: Fly Postgres has daily snapshots by default
- [ ] Review security: All secrets stored in `fly secrets`, not in code ✅

---

**Need help?** Check Fly.io docs: https://fly.io/docs/postgres/
