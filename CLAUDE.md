# Tiered Pricing Shopify App — Architecture & Critical Details

**Project created:** February 2026
**Framework:** Remix v2 (React Router v7) + Shopify App Remix SDK
**Purpose:** Enable merchants to create quantity breaks, customer tag-based pricing, and spend threshold discounts that apply automatically at checkout.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [How Discounts Work](#how-discounts-work)
5. [File Structure](#file-structure)
6. [Environment Variables](#environment-variables)
7. [Deployment](#deployment)
8. [Critical Implementation Details](#critical-implementation-details)
9. [Known Limitations](#known-limitations)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Shopify Admin (embedded app via App Bridge)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  Dashboard  │  │  Create/Edit │  │  Settings   │                │
│  │  (list rules) │ │  Tier Rule  │  │  (enable/   │                │
│  └──────┬──────┘  └──────┬───────┘  │   disable)  │                │
│         │                 │           └──────┬──────┘                │
└─────────┼─────────────────┼──────────────────┼───────────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
    ┌────────────────────────────────────────────────┐
    │ Remix App (Node.js server on Fly.io)          │
    │  ┌──────────────────────────────────────────┐ │
    │  │ Routes (app/routes/)                     │ │
    │  │  • app._index.tsx     → Dashboard        │ │
    │  │  • app.tiers.$id.tsx  → Create/Edit form │ │
    │  │  • app.settings.tsx   → Settings page    │ │
    │  │  • webhooks.*         → Shopify webhooks │ │
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
    │  │ Database (PostgreSQL via Prisma)         │ │
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
| **Runtime** | Node.js | 20.15.1+ | Alpine Linux in Docker |
| **Framework** | Remix | 2.16.1 | React Router v7 |
| **UI Library** | Shopify Polaris | 12.0.0 | Admin design system |
| **App Bridge** | @shopify/app-bridge-react | 4.1.6 | Embedded app SDK |
| **Database** | PostgreSQL | Latest | Prisma ORM |
| **Session Storage** | Prisma (PostgreSQL) | 8.0.0 | Shopify session adapter |
| **GraphQL Client** | Shopify Admin API | 2026-04 | Built into Shopify SDK |
| **Build Tool** | Vite | 6.2.2 | Bundler for Remix |
| **Package Manager** | npm | 10.7.0+ | |
| **Hosting** | Fly.io | — | Docker-based PaaS |

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
│   ├── shopify.server.ts               # Shopify auth + session config
│   └── root.tsx                        # Root layout
├── prisma/
│   ├── schema.prisma                   # Database schema (PostgreSQL)
│   └── migrations/                     # Auto-generated migrations
├── public/                             # Static assets
├── build/                              # Compiled output (gitignored)
├── .env                                # Environment variables (gitignored)
├── .env.example                        # Template for .env
├── Dockerfile                          # Docker image for Fly.io
├── fly.toml                            # Fly.io deployment config
├── shopify.app.toml                    # Shopify CLI config
├── package.json                        # Dependencies + scripts
├── tsconfig.json                       # TypeScript config
├── vite.config.ts                      # Vite bundler config
└── CLAUDE.md                           # This file
```

---

## Environment Variables

### Required in `.env` (development + production)

```bash
# Shopify credentials (from Partners dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret

# App URL (ngrok for dev, Fly URL for prod)
SHOPIFY_APP_URL=https://tiered-pricing.fly.dev

# OAuth scopes (must match shopify.app.toml)
SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders

# Database connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### How to set secrets on Fly.io

```bash
fly secrets set \
  SHOPIFY_API_KEY=... \
  SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://tiered-pricing.fly.dev \
  SCOPES=read_products,write_products,read_price_rules,write_price_rules,read_discounts,write_discounts,read_customers,read_orders

# DATABASE_URL is set automatically when you attach Postgres:
fly postgres attach tiered-pricing-db --app tiered-pricing
```

---

## Deployment

### Local development

```bash
npm install
npm run dev   # Runs `shopify app dev` (tunnel + dev server)
```

This:
- Starts Remix dev server on port 3000
- Opens ngrok tunnel
- Creates `.env` with credentials (first run)
- Installs app on your dev store

### Production (Fly.io)

```bash
# 1. Install + login
brew install flyctl
fly auth login

# 2. Create app
cd tiered-pricing
fly launch --name tiered-pricing --region iad

# 3. Create + attach Postgres (free tier)
fly postgres create --name tiered-pricing-db --region iad
fly postgres attach tiered-pricing-db --app tiered-pricing

# 4. Set secrets (see above)
fly secrets set SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... ...

# 5. Deploy
fly deploy
```

The `Dockerfile` runs:
1. `npm ci --omit=dev` — install production deps
2. `npm run build` — build Remix app
3. `npm run docker-start` — runs `prisma migrate deploy && remix-serve`

### Important: Update shopify.app.toml after deployment

Replace both `https://example.com` placeholders with your real Fly URL:
- `application_url = "https://tiered-pricing.fly.dev"`
- `auth.redirect_urls = [ "https://tiered-pricing.fly.dev/api/auth" ]`

Then push to Partners:
```bash
shopify app deploy
```

---

## Critical Implementation Details

### 1. Why PostgreSQL instead of SQLite?

SQLite uses a local file (`dev.sqlite`) which is:
- ✅ Perfect for local development
- ❌ Not suitable for production on Fly/Heroku/Vercel because:
  - Fly restarts wipe the filesystem → data loss
  - Can't scale horizontally (multiple VMs)
  - Vercel is serverless → no persistent filesystem

PostgreSQL is cloud-native and persists across restarts.

### 2. Why automatic discounts instead of discount codes?

**Automatic discounts** apply at checkout without codes — better UX:
- ✅ No code needed (customers don't have to remember/paste codes)
- ✅ Stackable (multiple discounts can apply together)
- ✅ Visible in cart before checkout (if UI extension added)

**Discount codes** require:
- ❌ Customer to manually enter a code
- ❌ One code per checkout (can't stack multiple rules)

Shopify's `DiscountAutomaticBasic` API is the modern standard for tiered pricing apps.

### 3. Why doesn't `CUSTOMER_TAG` enforce tags at checkout?

**Root cause:** Shopify's `DiscountAutomaticBasicInput` mutation does NOT accept a `customerSelection` field — automatic discounts apply to ALL customers by definition.

**Workaround options:**
1. **Storefront UI gating** (current): The discount shows to everyone but the UI warns "VIP only"
2. **Shopify Functions** (production-grade): A Discount Function extension can validate customer tags server-side at checkout and reject the discount if the tag is missing
3. **Price Rules API** (legacy): Old `PriceRule` API supports customer segments but is being deprecated

This is a **known limitation of all Shopify tiered pricing apps** that use automatic discounts. The title includes the tag name (`[Tiered] VIP Discount – Tag: vip`) so merchants can identify it in Shopify Admin → Discounts.

### 4. How does toggle (enable/disable) work?

When a merchant clicks "Disable" on a rule in the dashboard:
1. `toggleTierRule()` updates `isActive: false` in the database
2. `toggleShopifyDiscountsForRule()` calls `discountAutomaticDeactivate` on all linked Shopify discount GIDs
3. Shopify stops applying the discount at checkout immediately

The GIDs are preserved so re-enabling the rule reactivates the same Shopify discounts.

### 5. What happens on app uninstall?

**Immediate cleanup** (`webhooks.app.uninstalled.tsx`):
- Deletes all `TierRule` records for that shop
- Deletes all `AppSettings` for that shop
- Deletes all `Session` records

**Shopify cleanup** (automatic):
- All discounts created by the app are automatically deleted by Shopify when the app is uninstalled

**GDPR compliance** (`webhooks.shop.redact.tsx`):
- Fires 48 hours after uninstall
- Final confirmation — deletes any remaining data

### 6. Why are compliance webhooks mandatory?

GDPR + CCPA require apps to:
- **`customers/data_request`**: Return all personal data stored for a customer within 10 days
- **`customers/redact`**: Delete all personal data for a customer within 10 days
- **`shop/redact`**: Delete all shop data within 48 hours of uninstall

Shopify **rejects app submissions** that don't implement these webhooks. Our implementation returns 200 immediately because:
- This app stores NO customer-level personal data
- All data is shop-level (tier rules, settings)

If you add customer-specific features (e.g., wishlist, preferences), you MUST update these webhook handlers.

### 7. Why does the app use GraphQL instead of REST?

Shopify is deprecating REST APIs in favor of GraphQL:
- ✅ GraphQL is more flexible (request only needed fields)
- ✅ `DiscountAutomaticBasic` is only available in GraphQL
- ✅ Better versioning (Admin API 2026-04 is the current stable version)

The `@shopify/shopify-app-remix` SDK provides an `admin.graphql()` helper that handles authentication automatically.

---

## Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| **CUSTOMER_TAG discounts apply to all** | "VIP only" discount shows to everyone | Add Shopify Functions extension for server-side tag validation |
| **No storefront pricing table** | Customers can't see tier pricing on product pages | Build Theme App Extension (future feature) |
| **SQLite in dev, Postgres in prod** | Schema mismatch warnings | Run `prisma migrate dev` before deploying to sync schemas |
| **No analytics** | Can't track which tiers are most used | Add analytics route + dashboard (future feature) |
| **No bulk operations** | Editing multiple rules requires one-by-one clicks | Add bulk toggle/delete actions (future feature) |

---

## Troubleshooting

### Build fails with "Variable $automaticBasicDiscount was provided invalid value for customerSelection"

**Cause:** You passed `customerSelection` to `DiscountAutomaticBasicInput` — that field doesn't exist.

**Fix:** Remove `customerSelection` from the mutation input in `shopifyDiscount.server.ts`. Only `title`, `startsAt`, `endsAt`, `customerGets`, `minimumRequirement` are valid.

### App shows "Connection refused" or login page instead of embedded admin

**Cause:** The dev server (`npm run dev`) isn't running or `.env` is missing.

**Fix:**
1. Run `npm run dev` in a terminal (not via Claude Code)
2. The Shopify CLI auto-generates `.env` on first run
3. Access the app through **Shopify Admin → Apps → Tiered Pricing** (not `localhost:3000` directly)

### Database schema out of sync after switching SQLite → PostgreSQL

**Cause:** Migrations were created for SQLite but now the DB is Postgres.

**Fix:**
```bash
# Delete old migrations (backup first if you have prod data)
rm -rf prisma/migrations

# Recreate migrations for Postgres
npx prisma migrate dev --name init

# If deploying to Fly, run:
fly ssh console --app tiered-pricing
npm run setup  # Runs `prisma migrate deploy`
```

### Discount created but doesn't appear at checkout

**Possible causes:**
1. **Rule is disabled** — Check `isActive` in the database or dashboard
2. **Product mismatch** — Check `productIds`/`collectionIds` filters
3. **Quantity/spend not met** — Check `minimumRequirement` values
4. **Shopify discount conflict** — Shopify allows max 1 automatic discount per checkout. If another automatic discount exists with higher priority, ours won't apply.

**Debug steps:**
1. Go to Shopify Admin → Discounts
2. Find the discount (title: `[Tiered] ...`)
3. Check status (Active vs Inactive)
4. Check "Applies to" scope

### Fly deployment fails with "Error: P1001: Can't reach database server"

**Cause:** `DATABASE_URL` secret is missing or wrong.

**Fix:**
```bash
# Check if DATABASE_URL is set
fly secrets list --app tiered-pricing

# If missing, attach Postgres
fly postgres attach tiered-pricing-db --app tiered-pricing

# Restart app
fly apps restart tiered-pricing
```

---

## Future Enhancements

- [ ] **Theme App Extension** — Show pricing table on product pages
- [ ] **Shopify Functions** — Server-side tag validation for CUSTOMER_TAG type
- [ ] **Analytics dashboard** — Track which tiers are most used, revenue impact
- [ ] **Bulk operations** — Toggle/delete multiple rules at once
- [ ] **Import/export** — JSON-based rule backup/restore
- [ ] **A/B testing** — Run multiple tier strategies on different customer segments
- [ ] **Scheduled discounts** — Auto-activate rules at specific dates/times

---

## Support & Contribution

**Created by:** Claude (Anthropic)
**Maintained by:** [Your name/company]
**License:** MIT
**Shopify Partners:** https://partners.shopify.com
**Fly.io Docs:** https://fly.io/docs
**Prisma Docs:** https://www.prisma.io/docs

For bugs or feature requests, open an issue in the GitHub repo (if public) or contact support at [your email].

---

**Last updated:** February 18, 2026
**App version:** 1.0.0
**Shopify API version:** 2026-04
