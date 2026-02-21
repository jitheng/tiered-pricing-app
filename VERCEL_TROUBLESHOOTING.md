# Vercel Runtime Error Troubleshooting

## Latest Fix Applied (2026-02-21)

### Fix: Use Default Prisma Client Output Path

**Problem:** Custom Prisma output path `../node_modules/.prisma/client` was causing Node.js ESM resolver errors because package names cannot start with `.`

**Error:**
```
TypeError [ERR_INVALID_MODULE_SPECIFIER]: Invalid module ".prisma/client/default"
```

**Solution:**
1. ✅ Removed custom `output` from `prisma/schema.prisma`
2. ✅ Prisma now generates to default `./node_modules/@prisma/client`
3. ✅ Added `@shopify/shopify-app-session-storage-prisma` to `ssr.noExternal` in `vite.config.ts`
4. ✅ Kept `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Vercel compatibility

**Deployment Status:** In progress - check https://vercel.com/jithens-projects/tiered-pricing/deployments

---

## Previous Error (Now Fixed)

```
500: INTERNAL_SERVER_ERROR
Code: FUNCTION_INVOCATION_FAILED
```

The app builds successfully but crashes when Shopify tries to load it in the admin.

## Most Likely Causes

### 1. Environment Variable Mismatch (HIGHEST PRIORITY)

The `SHOPIFY_APP_URL` in Vercel **MUST** match the actual Vercel deployment URL.

**Check in Vercel Dashboard:**
1. Go to: https://vercel.com/jithens-projects/tiered-pricing/settings/environment-variables
2. Find `SHOPIFY_APP_URL`
3. Verify it shows: `https://tiered-pricing-hazel.vercel.app`
4. If it's different (e.g., `https://tiered-pricing.vercel.app`), **UPDATE IT**
5. After updating, redeploy

### 2. Missing DATABASE_URL

**Verify in Vercel:**
1. Go to: https://vercel.com/jithens-projects/tiered-pricing/settings/environment-variables
2. Confirm `DATABASE_URL` is set to your Neon connection string
3. It should start with: `postgresql://neondb_owner:...`

### 3. Missing or Incorrect Shopify Credentials

**Required Environment Variables:**
- ✅ `SHOPIFY_API_KEY` = `20a1a9a17d8990d496d11df0c8b93d20`
- ✅ `SHOPIFY_API_SECRET` = (your secret from .env.production)
- ✅ `SHOPIFY_APP_URL` = `https://tiered-pricing-hazel.vercel.app`
- ✅ `DATABASE_URL` = (your Neon connection string)
- ✅ `SCOPES` = `read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders`

### 4. Database Connection Issue

The Prisma Client might be failing to connect to Neon at runtime.

**Test:** Try accessing just the root URL without Shopify parameters:
```
https://tiered-pricing-hazel.vercel.app
```

If this also crashes, it's a database connection issue.

## How to View Detailed Logs

### Method 1: Vercel Dashboard
1. Go to: https://vercel.com/jithens-projects/tiered-pricing/deployments
2. Click on the latest deployment (should show "Ready")
3. Click "View Function Logs"
4. Look for error stack traces

### Method 2: Real-time Logs
1. In Vercel dashboard, click your project
2. Go to "Logs" tab
3. Set filter to "Errors" only
4. Try loading the app in Shopify admin
5. Watch for error messages

## Quick Fix Steps

### Step 1: Verify All Environment Variables

Run this checklist in Vercel dashboard:

```
Settings → Environment Variables

Required for Production:
[ ] DATABASE_URL (starts with postgresql://)
[ ] SHOPIFY_API_KEY
[ ] SHOPIFY_API_SECRET
[ ] SHOPIFY_APP_URL = https://tiered-pricing-hazel.vercel.app
[ ] SCOPES
[ ] NODE_ENV = production (optional)
```

### Step 2: Update SHOPIFY_APP_URL

If `SHOPIFY_APP_URL` was wrong:
1. Update in Vercel environment variables
2. Go to Deployments tab
3. Click "..." menu on latest deployment
4. Click "Redeploy"
5. Wait for new deployment to complete

### Step 3: Test Direct Access

Try accessing the app directly (not through Shopify):
```
https://tiered-pricing-hazel.vercel.app
```

**Expected Results:**
- ✅ If it loads: Environment variables are correct, issue is with Shopify OAuth
- ❌ If it crashes: Database connection or Prisma configuration issue

### Step 4: Check Vercel Function Logs

Look for these specific errors:

**Database Connection Error:**
```
PrismaClientInitializationError: Can't reach database server
```
**Fix:** Check DATABASE_URL is correct

**Missing Environment Variable:**
```
Error: SHOPIFY_API_KEY is required
```
**Fix:** Add missing environment variable

**Module Not Found:**
```
Cannot find module '.prisma/client'
```
**Fix:** Already handled by binaryTargets - should not occur

## Common Error Patterns

### Error: "Shop parameter is missing"
- Cause: `SHOPIFY_APP_URL` doesn't match actual URL
- Fix: Update SHOPIFY_APP_URL and redeploy

### Error: "Invalid HMAC"
- Cause: `SHOPIFY_API_SECRET` is incorrect
- Fix: Double-check secret from Shopify Partners dashboard

### Error: "Database connection timeout"
- Cause: DATABASE_URL is incorrect or Neon database is down
- Fix: Verify Neon connection string, check Neon dashboard

### Error: "Function timeout"
- Cause: Database query taking too long or cold start
- Fix: Normal for first request (cold start), should resolve on subsequent requests

## Next Steps

1. **Immediately check** `SHOPIFY_APP_URL` in Vercel - this is the most likely issue
2. View function logs in Vercel dashboard for exact error
3. Test direct URL access: https://tiered-pricing-hazel.vercel.app
4. If needed, I can add better error logging to the app

## Expected Successful Flow

When working correctly:
1. Shopify admin loads app with embedded=1 parameter
2. Remix app authenticates the request via `authenticate.admin()`
3. App connects to Neon database via Prisma
4. App loads tier rules and renders dashboard
5. User sees the Tiered Pricing dashboard

## Debug Mode (If Needed)

If errors persist, we can add temporary logging:

1. Add console.log to app entry point
2. Log environment variables (without secrets)
3. Log database connection attempts
4. View in Vercel function logs

Let me know what you see in the Vercel function logs and I can provide specific fixes!
