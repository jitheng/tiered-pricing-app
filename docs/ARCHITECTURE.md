# Tiered Pricing App - Architecture Documentation

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SHOPIFY ECOSYSTEM                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     Shopify Admin (Browser)                            │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Embedded App (iframe)                        │   │  │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │   │  │
│  │  │  │   Dashboard   │  │  Rule Editor  │  │   Settings    │       │   │  │
│  │  │  │   (Polaris)   │  │   (Polaris)   │  │   (Polaris)   │       │   │  │
│  │  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘       │   │  │
│  │  │          │                  │                  │               │   │  │
│  │  │          └──────────────────┼──────────────────┘               │   │  │
│  │  │                             │                                   │   │  │
│  │  │                    App Bridge React                            │   │  │
│  │  └─────────────────────────────┼───────────────────────────────────┘   │  │
│  └────────────────────────────────┼────────────────────────────────────────┘  │
│                                   │                                          │
│                                   │ HTTPS                                    │
│                                   ▼                                          │
└──────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼

┌──────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL PLATFORM                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     Serverless Functions (Node.js)                     │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                         Remix App                                │   │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │  │
│  │  │  │   Routes    │  │   Models    │  │  Shopify    │              │   │  │
│  │  │  │  (Loaders/  │──│  (Business  │──│   Server    │              │   │  │
│  │  │  │  Actions)   │  │   Logic)    │  │   (Auth)    │              │   │  │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │   │  │
│  │  │         │                │                │                      │   │  │
│  │  │         │                │                │                      │   │  │
│  │  │         ▼                ▼                ▼                      │   │  │
│  │  │  ┌─────────────────────────────────────────────────────────────┐ │   │  │
│  │  │  │                    Prisma ORM Client                        │ │   │  │
│  │  │  └─────────────────────────────────────────────────────────────┘ │   │  │
│  │  └───────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘

         │                                                    │
         │ GraphQL                                            │ PostgreSQL
         ▼                                                    ▼

┌──────────────────────────────┐          ┌──────────────────────────────┐
│       SHOPIFY PLATFORM       │          │         NEON DATABASE        │
│  ┌────────────────────────┐  │          │  ┌────────────────────────┐  │
│  │     Admin API          │  │          │  │      PostgreSQL        │  │
│  │  (GraphQL 2025-01)     │  │          │  │                        │  │
│  │                        │  │          │  │  ┌──────────────────┐  │  │
│  │  • Discount Mutations  │  │          │  │  │    TierRule      │  │  │
│  │  • Product Queries     │  │          │  │  │    TierLevel     │  │  │
│  │  • Shop Data           │  │          │  │  │    AppSettings   │  │  │
│  └────────────────────────┘  │          │  │  │    Session       │  │  │
│                              │          │  │  └──────────────────┘  │  │
│  ┌────────────────────────┐  │          │  └────────────────────────┘  │
│  │   Automatic Discounts  │  │          └──────────────────────────────┘
│  │   (DiscountAutomatic)  │  │
│  │                        │  │
│  │  Applied at checkout   │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## Request Flow

### 1. App Installation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Merchant   │     │   Shopify    │     │  Vercel App  │     │   Database   │
│   Browser    │     │   Platform   │     │  (Remix)     │     │   (Neon)     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  1. Install App    │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │  2. OAuth Redirect │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │  3. Exchange Token │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │  4. Access Token   │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │  5. Create Session │
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │  6. Redirect to App                     │                    │
       │<────────────────────────────────────────│                    │
       │                    │                    │                    │
```

### 2. Create Tier Rule Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Merchant   │     │  Vercel App  │     │   Shopify    │     │   Database   │
│   (Browser)  │     │  (Remix)     │     │   Admin API  │     │   (Neon)     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  1. Submit Form    │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │  2. Save TierRule  │                    │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │                    │                    │    3. Return ID    │
       │                    │<────────────────────────────────────────│
       │                    │                    │                    │
       │                    │  4. For each TierLevel:                 │
       │                    │  Create Discount   │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │  5. Discount GID   │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │  6. Update TierLevel with GID           │
       │                    │────────────────────────────────────────>│
       │                    │                    │                    │
       │  7. Success Response                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
```

---

## Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TierRule                                  │
├─────────────────────────────────────────────────────────────────────┤
│  id          : String (CUID)    [PK]                               │
│  shop        : String           [Indexed]                          │
│  name        : String                                              │
│  type        : String           ["QUANTITY"|"CUSTOMER_TAG"|"SPEND"]│
│  productIds  : String (JSON)                                       │
│  collectionIds: String (JSON)                                      │
│  isActive    : Boolean                                             │
│  createdAt   : DateTime                                            │
│  updatedAt   : DateTime                                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ 1:N
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          TierLevel                                  │
├─────────────────────────────────────────────────────────────────────┤
│  id              : String (CUID)    [PK]                           │
│  ruleId          : String           [FK → TierRule.id]             │
│  minValue        : Float                                           │
│  maxValue        : Float?                                          │
│  tagValue        : String?                                         │
│  discount        : Float                                           │
│  type            : String           ["PERCENTAGE"|"FIXED"]         │
│  label           : String?                                         │
│  sortOrder       : Int                                             │
│  shopifyDiscountId: String?         [Shopify GID]                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          AppSettings                                │
├─────────────────────────────────────────────────────────────────────┤
│  id              : String (CUID)    [PK]                           │
│  shop            : String           [Unique]                       │
│  isEnabled       : Boolean                                         │
│  showPricingTable: Boolean                                         │
│  currency        : String                                          │
│  createdAt       : DateTime                                        │
│  updatedAt       : DateTime                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                            Session                                  │
├─────────────────────────────────────────────────────────────────────┤
│  id              : String           [PK]                           │
│  shop            : String                                          │
│  state           : String                                          │
│  isOnline        : Boolean                                         │
│  scope           : String?                                         │
│  expires         : DateTime?                                       │
│  accessToken     : String                                          │
│  userId          : BigInt?                                         │
│  ...             : (other OAuth fields)                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
tiered-pricing/
│
├── app/                              # Remix application code
│   ├── routes/                       # File-based routing
│   │   ├── app._index.tsx           # Dashboard (rule list)
│   │   ├── app.tiers.$id.tsx        # Create/Edit rule form
│   │   ├── app.settings.tsx         # App settings page
│   │   ├── app.tsx                  # App layout wrapper
│   │   ├── test-prisma.tsx          # Health check endpoint
│   │   ├── auth.$.tsx               # OAuth callback splat route
│   │   ├── auth.login/route.tsx     # Login fallback
│   │   └── webhooks.*.tsx           # Webhook handlers
│   │
│   ├── models/                       # Business logic layer
│   │   ├── tierRule.server.ts       # TierRule CRUD operations
│   │   ├── shopifyDiscount.server.ts # Shopify API discount operations
│   │   └── appSettings.server.ts    # AppSettings CRUD operations
│   │
│   ├── db.server.ts                 # Prisma client singleton
│   ├── prisma-client.server.ts      # Prisma re-export helper
│   ├── shopify.server.ts            # Shopify app configuration
│   └── root.tsx                     # Root layout component
│
├── prisma/                           # Database configuration
│   ├── schema.prisma                # Prisma schema definition
│   └── migrations/                  # Database migrations
│
├── docs/                             # Documentation
│   └── ARCHITECTURE.md              # This file
│
├── public/                           # Static assets
│
├── vite.config.ts                   # Vite + Remix configuration
├── vercel.json                      # Vercel deployment config
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── shopify.app.toml                 # Shopify CLI config
└── CLAUDE.md                        # Main documentation
```

---

## Key Configuration Files

### vite.config.ts (Critical for Vercel + Prisma)

```typescript
import { vitePlugin as remix } from "@remix-run/dev";
import { vercelPreset } from "@vercel/remix/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      presets: [vercelPreset()],  // Required for Vercel
      future: { /* Remix future flags */ },
    }),
    tsconfigPaths(),
  ],

  // CRITICAL: External Prisma for Vercel file tracing
  ssr: {
    external: ["@prisma/client", ".prisma/client"],
  },

  optimizeDeps: {
    include: ["@shopify/app-bridge-react", "@shopify/polaris"],
  },
});
```

### vercel.json

```json
{
  "buildCommand": "rm -rf build node_modules/.vite node_modules/.prisma && npx prisma generate && npm run build",
  "installCommand": "npm install --legacy-peer-deps",
  "framework": "remix",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### prisma/schema.prisma

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Deployment Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   GitHub     │     │    Vercel    │     │   Vercel     │     │  Production  │
│   (main)     │────>│    Build     │────>│   Deploy     │────>│    Live      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │  1. npm install    │
       │                    │  2. prisma generate│
       │                    │  3. remix build    │
       │                    │  4. Bundle SSR     │
       │                    │  5. File tracing   │
       │                    │                    │
       │                    │                    │  - Edge network
       │                    │                    │  - Serverless fns
       │                    │                    │  - Auto SSL
```

### Branch Strategy

| Branch | Environment | Auto-Deploy |
|--------|-------------|-------------|
| `main` | Production | ✅ Yes |
| `prod` | Preview | ✅ Yes |
| `staging` | Preview | ✅ Yes |
| `dev` | Preview | ✅ Yes |

---

## Security Considerations

1. **OAuth Flow**: Handled by `@shopify/shopify-app-remix`
2. **HMAC Validation**: All webhook requests validated
3. **Session Management**: Currently MemorySessionStorage (temporary)
4. **Environment Variables**: Stored in Vercel, never in code
5. **GDPR Compliance**: Webhook handlers for data requests/redaction

---

## Performance Optimizations

1. **Serverless Cold Starts**: Minimized by keeping functions small
2. **Prisma Connection Pooling**: Using Neon's serverless driver
3. **Vite Build**: Code splitting and tree shaking
4. **Polaris CSS**: Loaded from Shopify CDN

---

## Monitoring & Health Checks

- **Endpoint**: `/test-prisma`
- **Vercel Dashboard**: https://vercel.com/jithens-projects/tiered-pricing
- **Function Logs**: Available in Vercel dashboard

---

**Last Updated:** February 25, 2026
