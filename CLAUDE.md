# Tiered Pricing Shopify App — Architecture & Critical Details

**Project created:** February 2026
**Framework:** Remix v2 (React Router v7) + Shopify App Remix SDK
**Hosting:** Vercel (Serverless)
**Purpose:** Enable merchants to create quantity breaks, customer tag-based pricing, and spend threshold discounts that apply automatically at checkout.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [How Discounts Work](#how-discounts-work)
5. [File Structure](#file-structure)
6. [Environment Variables](#environment-variables)
7. [Deployment (Vercel)](#deployment-vercel)
8. [Critical Implementation Details](#critical-implementation-details)
9. [Vercel + Prisma ESM Fix](#vercel--prisma-esm-fix)
10. [Known Limitations](#known-limitations)
11. [Troubleshooting](#troubleshooting)
12. [Change Log](#change-log)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Shopify Admin (embedded app via App Bridge)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  Dashboard  │  │  Create/Edit │  │  Settings   │                │
│  │  (list rules)│  │  Tier Rule  │  │  (enable/   │                │
│  └──────┬──────┘  └──────┬───────┘  │   disable)  │                │
│         │                │           └──────┬──────┘                │
└─────────┼────────────────┼──────────────────┼───────────────────────┘
          │                │                  │
          ▼                ▼                  ▼
    ┌────────────────────────────────────────────────┐
    │ Remix App (Vercel Serverless Functions)       │
    │  ┌──────────────────────────────────────────┐ │
    │  │ Routes (app/routes/)                     │ │
    │  │  • app._index.tsx     → Dashboard        │ │
    │  │  • app.tiers.$id.tsx  → Create/Edit form │ │
    │  │  • app.settings.tsx   → Settings page    │ │
    │  │  • webhooks.*         → Shopify webhooks │ │
    │  │  • test-prisma.tsx    → Health check     │ │
    │  └──────────────┬───────────────────────────┘ │
    │                 │                              │
    │  ┌──────────────▼───────────────────────────┐ │
    │  │ Models (app/models/)                     │ │
    │  │  • tierRule.server.ts    → CRUD logic    │ │
    │  │  • shopifyDiscount.server.ts → Shopify   │ │
    │  │    GraphQL API calls (create/delete      │ │
    │  │    automatic discounts)                  │ │
    │  └──────────────┬───────────────────────────┘ │
    │                 │                              │
    │  ┌──────────────▼───────────────────────────┐ │
    │  │ Database (Neon PostgreSQL via Prisma)    │ │
    │  │  • TierRule      → Pricing rule config   │ │
    │  │  • TierLevel     → Each discount tier    │ │
    │  │  • AppSettings   → Per-merchant settings │ │
    │  │  • Session       → OAuth sessions        │ │
    │  └──────────────────────────────────────────┘ │
    └────────────────────────────────────────────────┘
                          │
                          ▼
    ┌────────────────────────────────────────────────┐
    │ Shopify Platform                               │
    │  ┌──────────────────────────────────────────┐ │
    │  │ Automatic Discounts (Admin API)          │ │
    │  │  • DiscountAutomaticBasic nodes created  │ │
    │  │    via GraphQL for each TierLevel        │ │
    │  │  • Applied automatically at checkout     │ │
    │  └──────────────────────────────────────────┘ │
    └────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Runtime** | Node.js | 20.10+ | Vercel Serverless |
| **Framework** | Remix | 2.16.1 | React Router v7 |
| **UI Library** | Shopify Polaris | 12.0.0 | Admin design system |
| **App Bridge** | @shopify/app-bridge-react | 4.1.6 | Embedded app SDK |
| **Database** | Neon PostgreSQL | Latest | Serverless Postgres |
| **ORM** | Prisma | 6.2.1 | Database client |
| **Session Storage** | MemorySessionStorage | 5.0.5 | Temporary (see notes) |
| **GraphQL Client** | Shopify Admin API | 2025-01 | Built into Shopify SDK |
| **Build Tool** | Vite | 6.2.2 | Bundler for Remix |
| **Vercel Preset** | @vercel/remix | 2.16.7 | Vercel integration |
| **Hosting** | Vercel | — | Serverless platform |

---

## Database Schema

### **TierRule** — Represents a pricing strategy

| Field | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `shop` | String | Merchant's myshopify.com domain (indexed) |
| `name` | String | Rule display name (e.g., "VIP Discount") |
| `type` | String | Enum: `"QUANTITY"`, `"CUSTOMER_TAG"`, `"SPEND"` |
| `productIds` | String (JSON) | Array of Shopify product GIDs to apply rule to (empty = all) |
| `collectionIds` | String (JSON) | Array of Shopify collection GIDs |
| `isActive` | Boolean | Whether the rule is currently enabled |
| `createdAt` | DateTime | Timestamp |
| `updatedAt` | DateTime | Auto-updated timestamp |
| **Relation** | → `TierLevel[]` | One-to-many levels |

### **TierLevel** — Each tier within a rule (e.g., "Buy 5-9 → 10% off")

| Field | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `ruleId` | String | Foreign key to TierRule (indexed, cascade delete) |
| `minValue` | Float | Min quantity / min spend |
| `maxValue` | Float? | Max quantity / spend (null = unlimited) |
| `tagValue` | String? | Customer tag name (for `CUSTOMER_TAG` type) |
| `discount` | Float | Discount amount |
| `type` | String | `"PERCENTAGE"` or `"FIXED"` |
| `label` | String? | Display label (e.g., "Wholesale") |
| `sortOrder` | Int | Order for display (0-indexed) |
| `shopifyDiscountId` | String? | GID of the Shopify DiscountAutomaticNode created for this level |

### **AppSettings** — Per-merchant global settings

| Field | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `shop` | String (unique) | Merchant's myshopify.com domain |
| `isEnabled` | Boolean | Master on/off switch for all discounts |
| `showPricingTable` | Boolean | Show pricing table on storefront (future feature) |
| `currency` | String | Default currency code (e.g., "USD") |
| `createdAt` | DateTime | Timestamp |
| `updatedAt` | DateTime | Auto-updated timestamp |

### **Session** — OAuth session data (managed by Shopify SDK)

Standard Shopify session model — stores access tokens, scopes, shop info.

---

## How Discounts Work

### Step-by-step discount creation flow

1. **User creates a tier rule** via [app.tiers.$id.tsx](app/routes/app.tiers.$id.tsx)
   Example: "VIP Discount" → Customer Tag type → Tag: `vip` → 20% off

2. **Action handler saves to DB** via [tierRule.server.ts](app/models/tierRule.server.ts)
   Creates `TierRule` + `TierLevel` records in PostgreSQL

3. **Discount engine creates Shopify discounts** via [shopifyDiscount.server.ts](app/models/shopifyDiscount.server.ts)
   For each `TierLevel`:
   - Calls `discountAutomaticBasicCreate` GraphQL mutation
   - Creates a Shopify `DiscountAutomaticNode` with:
     - Title: `[Tiered] VIP Discount – Tag: vip`
     - `customerGets`: discount percentage/fixed amount
     - `minimumRequirement`: quantity/spend threshold (if applicable)
   - Stores returned GID back on `TierLevel.shopifyDiscountId`

4. **Shopify applies discount at checkout automatically**
   No discount codes required — discounts are automatic.

### Key mutations used

```graphql
# Create automatic discount
mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
  discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
    automaticDiscountNode { id }
    userErrors { field message }
  }
}

# Delete automatic discount
mutation discountAutomaticDelete($id: ID!) {
  discountAutomaticDelete(id: $id) {
    deletedAutomaticDiscountId
    userErrors { field message }
  }
}

# Activate/Deactivate
mutation discountAutomaticActivate($id: ID!) { ... }
mutation discountAutomaticDeactivate($id: ID!) { ... }
```

### Discount sync lifecycle

| Event | Database | Shopify API |
|---|---|---|
| **Create rule** | Insert TierRule + TierLevels | Call `discountAutomaticBasicCreate` for each level |
| **Update rule** | Delete old TierLevels, insert new | Delete old discounts, create new |
| **Toggle rule** | Update `isActive` | Call `activate` or `deactivate` |
| **Delete rule** | Delete TierRule (cascade to TierLevels) | Call `discountAutomaticDelete` for each level |
| **App uninstall** | Delete all shop data | Shopify auto-deletes discounts |

---

## File Structure

```
tiered-pricing/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx              # Dashboard — list all tier rules
│   │   ├── app.tiers.$id.tsx           # Create/Edit tier rule form
│   │   ├── app.settings.tsx            # App settings (enable/disable, currency)
│   │   ├── app.tsx                     # Layout + navigation
│   │   ├── auth.$.tsx                  # OAuth callback
│   │   ├── auth.login/route.tsx        # Login page (fallback)
│   │   ├── test-prisma.tsx             # Prisma health check endpoint
│   │   ├── webhooks.app.uninstalled.tsx          # Cleanup on uninstall
│   │   ├── webhooks.app.scopes_update.tsx        # Scope change notification
│   │   ├── webhooks.customers.data_request.tsx   # GDPR compliance
│   │   ├── webhooks.customers.redact.tsx         # GDPR compliance
│   │   └── webhooks.shop.redact.tsx              # GDPR compliance
│   ├── models/
│   │   ├── tierRule.server.ts          # CRUD for tier rules (DB only)
│   │   ├── shopifyDiscount.server.ts   # Shopify GraphQL discount engine
│   │   └── appSettings.server.ts       # Settings CRUD
│   ├── db.server.ts                    # Prisma client singleton
│   ├── prisma-client.server.ts         # Prisma re-export for consistent imports
│   ├── shopify.server.ts               # Shopify auth + session config
│   └── root.tsx                        # Root layout
├── prisma/
│   ├── schema.prisma                   # Database schema (PostgreSQL)
│   └── migrations/                     # Auto-generated migrations
├── public/                             # Static assets
├── build/                              # Compiled output (gitignored)
├── .env                                # Environment variables (gitignored)
├── .env.example                        # Template for .env
├── vercel.json                         # Vercel deployment config
├── shopify.app.toml                    # Shopify CLI config
├── package.json                        # Dependencies + scripts
├── tsconfig.json                       # TypeScript config
├── vite.config.ts                      # Vite bundler config (CRITICAL)
└── CLAUDE.md                           # This file
```

---

## Environment Variables

### Required in `.env` (development + production)

```bash
# Shopify credentials (from Partners dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret

# App URL (Vercel URL for prod)
SHOPIFY_APP_URL=https://tiered-pricing-hazel.vercel.app

# OAuth scopes (must match shopify.app.toml)
SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders

# Database connection string (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SHOPIFY_API_KEY` | From Shopify Partners Dashboard |
| `SHOPIFY_API_SECRET` | From Shopify Partners Dashboard |
| `SHOPIFY_APP_URL` | `https://tiered-pricing-hazel.vercel.app` |
| `SCOPES` | Shopify API scopes |
| `NODE_ENV` | `production` |

---

## Deployment (Vercel)

### Production URL
**https://tiered-pricing-hazel.vercel.app**

### Git Branch Strategy

| Branch | Purpose | Vercel Environment |
|---|---|---|
| `main` | Production | Production (auto-deploy) |
| `prod` | Pre-production testing | Preview |
| `staging` | Staging environment | Preview |
| `dev` | Development | Preview |

### vercel.json Configuration

```json
{
    "buildCommand": "rm -rf build node_modules/.vite node_modules/.prisma && npx prisma generate && npm run build",
    "devCommand": "npm run dev",
    "installCommand": "npm install --legacy-peer-deps",
    "framework": "remix",
    "regions": ["iad1"],
    "env": {
        "NODE_ENV": "production"
    },
    "build": {
        "env": {
            "ENABLE_EXPERIMENTAL_COREPACK": "1",
            "REMIX_SERVER_MODULE_FORMAT": "esm",
            "FORCE_CLEAN_BUILD": "true"
        }
    }
}
```

### Deployment Commands

```bash
# Push to main branch triggers automatic deployment
git push origin main

# Check deployment status
# Visit: https://vercel.com/jithens-projects/tiered-pricing/deployments
```

### Important: Update shopify.app.toml

Ensure URLs match your Vercel deployment:
- `application_url = "https://tiered-pricing-hazel.vercel.app"`
- `auth.redirect_urls = [ "https://tiered-pricing-hazel.vercel.app/auth/callback" ]`

Then push to Partners:
```bash
shopify app deploy
```

---

## Critical Implementation Details

### 1. Why Vercel instead of Fly.io?

Vercel provides:
- ✅ Automatic GitHub deployments
- ✅ Serverless functions (no server management)
- ✅ Edge network for fast global response
- ✅ Preview deployments for branches
- ✅ Built-in Remix support via `@vercel/remix`

### 2. Prisma ESM Module Resolution (CRITICAL)

Prisma generates code to `node_modules/.prisma/client`. However, Node.js ESM rejects module specifiers starting with `.` (ERR_INVALID_MODULE_SPECIFIER).

**Solution:** Mark both `@prisma/client` AND `.prisma/client` as external in Vite SSR config. This lets Vercel's file tracing properly include the Prisma query engine binaries.

See [Vercel + Prisma ESM Fix](#vercel--prisma-esm-fix) section for details.

### 3. Session Storage (MemorySessionStorage)

Currently using `MemorySessionStorage` as a temporary solution:
- ⚠️ Sessions are lost when serverless function restarts
- ⚠️ Not suitable for high-traffic production
- ✅ Works for development and low-traffic

**Future improvement:** Implement Redis session storage (Upstash) for persistent sessions.

### 4. Embedded App Navigation

In Shopify embedded apps, use Remix's `useNavigate()` hook for navigation, NOT `window.location.href`. Direct window navigation breaks out of the embedded iframe context.

**Correct:**
```tsx
const navigate = useNavigate();
<button onClick={() => navigate("/app/tiers/new")}>Create</button>
```

**Incorrect:**
```tsx
<button onClick={() => window.location.href = "/app/tiers/new"}>Create</button>
```

### 5. Why automatic discounts instead of discount codes?

**Automatic discounts** apply at checkout without codes — better UX:
- ✅ No code needed (customers don't have to remember/paste codes)
- ✅ Stackable (multiple discounts can apply together)
- ✅ Visible in cart before checkout (if UI extension added)

### 6. What happens on app uninstall?

**Immediate cleanup** (`webhooks.app.uninstalled.tsx`):
- Deletes all `TierRule` records for that shop
- Deletes all `AppSettings` for that shop
- Deletes all `Session` records

**Shopify cleanup** (automatic):
- All discounts created by the app are automatically deleted by Shopify

---

## Vercel + Prisma ESM Fix

### The Problem

When deploying Remix + Prisma to Vercel, you may encounter:

```
TypeError [ERR_INVALID_MODULE_SPECIFIER]: Invalid module ".prisma/client/default"
```

**Root cause:** Prisma generates client code to `node_modules/.prisma/client`. Node.js ESM resolver rejects package names starting with `.`.

### The Solution

**vite.config.ts** must externalize both Prisma packages:

```typescript
export default defineConfig({
  // ... other config

  // CRITICAL: Keep Prisma external so Vercel can trace query engine binaries
  ssr: {
    external: ["@prisma/client", ".prisma/client"],
  },

  plugins: [
    remix({
      presets: [vercelPreset()],  // Required for Vercel
      // ... other options
    }),
    tsconfigPaths(),
  ],
}) satisfies UserConfig;
```

### Why This Works

1. **External = Not Bundled:** Marking these as external tells Vite NOT to bundle Prisma into the server code
2. **Vercel File Tracing:** Vercel's `@vercel/nft` (Node File Trace) automatically detects external dependencies and includes them in the serverless function
3. **Binary Inclusion:** The Prisma query engine binaries (`rhel-openssl-3.0.x`) are properly traced and included

### Prisma Schema Configuration

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]  // Vercel Lambda runtime
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Build Command

The `vercel.json` build command cleans caches before building:

```json
{
  "buildCommand": "rm -rf build node_modules/.vite node_modules/.prisma && npx prisma generate && npm run build"
}
```

This ensures:
1. Fresh Prisma client generation
2. No stale Vite cache
3. Clean build every deployment

---

## Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| **MemorySessionStorage** | Sessions lost on function restart | Implement Redis (Upstash) |
| **CUSTOMER_TAG discounts apply to all** | "VIP only" discount shows to everyone | Add Shopify Functions extension |
| **No storefront pricing table** | Customers can't see tier pricing | Build Theme App Extension |
| **No analytics** | Can't track tier usage | Add analytics dashboard |
| **No bulk operations** | One-by-one rule editing | Add bulk actions |

---

## Troubleshooting

### ERR_INVALID_MODULE_SPECIFIER: ".prisma/client/default"

**Cause:** Prisma not properly externalized in Vite config.

**Fix:** Ensure `vite.config.ts` has:
```typescript
ssr: {
  external: ["@prisma/client", ".prisma/client"],
}
```

### "Create Rule" button asks for Shop domain / Login

**Cause:** Using `window.location.href` instead of Remix navigation.

**Fix:** Use `useNavigate()` hook:
```typescript
const navigate = useNavigate();
<button onClick={() => navigate("/app/tiers/new")}>Create</button>
```

### App shows login page instead of embedded admin

**Cause:** Accessing app directly instead of through Shopify Admin.

**Fix:**
1. Access via **Shopify Admin → Apps → Tiered Pricing**
2. Ensure `SHOPIFY_APP_URL` matches your Vercel URL
3. Run `shopify app deploy` to sync URLs with Partners

### Build fails on Vercel

**Check:**
1. Vercel Dashboard → Deployments → View logs
2. Ensure all environment variables are set
3. Check `vercel.json` configuration

### Database connection fails

**Cause:** `DATABASE_URL` not set or incorrect.

**Fix:**
1. Verify `DATABASE_URL` in Vercel environment variables
2. Ensure Neon database is active
3. Check SSL mode (`?sslmode=require`)

### Test Prisma Connection

Visit `/test-prisma` endpoint to verify Prisma works:
```
https://tiered-pricing-hazel.vercel.app/test-prisma
```

Expected response:
```json
{
  "status": "success",
  "message": "Prisma Client working correctly",
  "prismaClientAvailable": true
}
```

---

## Change Log

### 2026-02-25 - Vercel Deployment Fix (MAJOR)

**Problem:** `ERR_INVALID_MODULE_SPECIFIER: Invalid module ".prisma/client/default"`

**Solution Applied:**
1. ✅ Reverted to standard `@prisma/client` imports
2. ✅ Added both `@prisma/client` AND `.prisma/client` to `ssr.external`
3. ✅ Added `@vercel/remix` preset for proper Vercel integration
4. ✅ Updated build command to clean caches

**Files Modified:**
- `vite.config.ts` - SSR external config
- `vercel.json` - Build configuration
- `app/db.server.ts` - Standard Prisma import
- `app/shopify.server.ts` - MemorySessionStorage
- `package.json` - Added `@vercel/remix`, `@shopify/shopify-app-session-storage-memory`

### 2026-02-25 - Navigation Fix

**Problem:** "Create Rule" button asked for login instead of navigating

**Solution:** Changed from `window.location.href` to Remix `useNavigate()`

**Files Modified:**
- `app/routes/app._index.tsx` - TitleBar button navigation

### Initial Release - 2026-02

**Features:**
- Quantity break pricing
- Customer tag-based pricing
- Spend threshold discounts
- Automatic Shopify discount creation
- Dashboard with rule management
- GDPR compliance webhooks

---

## Future Enhancements

- [ ] **Redis Session Storage** — Replace MemorySessionStorage with Upstash Redis
- [ ] **Theme App Extension** — Show pricing table on product pages
- [ ] **Shopify Functions** — Server-side tag validation for CUSTOMER_TAG type
- [ ] **Analytics dashboard** — Track which tiers are most used, revenue impact
- [ ] **Bulk operations** — Toggle/delete multiple rules at once
- [ ] **Import/export** — JSON-based rule backup/restore
- [ ] **Scheduled discounts** — Auto-activate rules at specific dates/times

---

## Support & Contribution

**Repository:** https://github.com/jitheng/tiered-pricing-app
**Production URL:** https://tiered-pricing-hazel.vercel.app
**Shopify Partners:** https://partners.shopify.com
**Vercel Dashboard:** https://vercel.com/jithens-projects/tiered-pricing
**Prisma Docs:** https://www.prisma.io/docs

---

**Last updated:** February 25, 2026
**App version:** 1.1.0
**Shopify API version:** 2025-01
