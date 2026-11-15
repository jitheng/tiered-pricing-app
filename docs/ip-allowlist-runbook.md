# Shopify IP Allowlist — Static Egress Runbook (Fly.io + squid)

**Goal:** make every Shopify Admin API request from this app exit through a fixed
IP, allowlist that IP in Shopify, and enable enforcement — before the public-app
deadlines (**delist Nov 20 2026**, **full enforcement Apr 1 2027**).

**Why a proxy:** the app runs on Vercel serverless (region `iad1`); its egress
IPs come from a large, shifting pool and can't be enumerated into a CIDR.
Vercel's native static egress (Secure Compute) is Enterprise-only and this team
is not Enterprise. So we route outbound `fetch` through a self-hosted squid proxy
on Fly.io with a **dedicated IPv4** (~$2/mo) that we allowlist. (QuotaGuard
Static no longer offers a free tier, hence self-hosting.)

**How the code hooks in:** `app/egress-proxy.server.ts` installs an undici
`ProxyAgent` global dispatcher when `SHOPIFY_EGRESS_PROXY_URL` is set (wired at
the top of `app/shopify.server.ts`). Off by default. Only `fetch` is proxied —
Prisma→Neon DB traffic is TCP and is never proxied.

The proxy itself lives in `infra/egress-proxy/` (Dockerfile, squid.conf, fly.toml).

---

## Steps

### 1. Deploy the proxy to Fly.io

Full detail in `infra/egress-proxy/README.md`. Summary:

```bash
cd infra/egress-proxy
fly apps create tiered-pricing-egress          # pick a unique name; match fly.toml
fly ips allocate-v4 --app tiered-pricing-egress # dedicated IPv4 (~$2/mo) — note it
fly secrets set PROXY_USER=tiered PROXY_PASS="$(openssl rand -hex 24)" --app tiered-pricing-egress
fly deploy --app tiered-pricing-egress
fly ips list --app tiered-pricing-egress        # confirm the dedicated v4
```

Record the **dedicated IPv4** and the `PROXY_PASS` — you need both next.

### 2. Set the env var in Vercel

Vercel → Project `tiered-pricing` → Settings → Environment Variables:

- **Key:** `SHOPIFY_EGRESS_PROXY_URL`
- **Value:** `http://PROXY_USER:PROXY_PASS@<dedicated-ipv4>:3128`
- **Environments:** Production (add Preview too if you want preview deploys to
  reach Shopify). Redeploy so the new env is picked up.

> Never commit the real value — it embeds proxy credentials. Use the IPv4 as the
> host; the `*.fly.dev` name only works for Fly-proxied HTTP, not raw TCP 3128.

### 3. Verify egress actually exits via the proxy

```bash
# Should print the Fly dedicated IPv4:
curl -s -x "http://USER:PASS@<ipv4>:3128" https://api.ipify.org ; echo
# Shopify host tunnels; a non-Shopify host is denied (403) by the allowlist:
curl -s -o /dev/null -w "shopify:%{http_code}\n" -x "http://USER:PASS@<ipv4>:3128" https://admin.shopify.com
curl -s -o /dev/null -w "other:%{http_code}\n"   -x "http://USER:PASS@<ipv4>:3128" https://example.com
```

In the running app, a successful Admin API call (load the dashboard, which lists
rules) confirms the path end-to-end; the boot log prints
`[TieredPricing] Egress proxy enabled for outbound fetch.`

### 4. Add the IP to Shopify's allowlist

Shopify Dev Dashboard → your app → **API access → IP allowlist**:

- Add the Fly dedicated IPv4 as a `/32` CIDR (e.g. `203.0.113.10/32`).
- With a single dedicated IP there's just one entry — simpler than shared-proxy
  providers that rotate between several IPs.

### 5. Test against recent traffic, then enforce

- Use the dashboard's **test against recent traffic** tool first — it flags any
  request that would be blocked. All app traffic should show the Fly IP.
- Only once it's clean, **enable enforcement**. Enabling before steps 3–4 are
  verified will 403 your own app.

### 6. Rollback

Unset `SHOPIFY_EGRESS_PROXY_URL` in Vercel and redeploy (reverts to direct
egress), and/or disable allowlist enforcement in Shopify.

---

## Gotchas

- **IP must match:** the proxy's outbound IP and the Shopify-allowlisted IP must
  be identical, or you self-403.
- **Single point of failure:** every Admin API call now goes through this one
  box. It's set always-on (`min_machines_running = 1`); point an uptime monitor
  at `IP:3128` and watch `fly logs`. If it's down, discounts stop syncing.
- **Scope:** the allowlist covers Admin GraphQL/REST only — not OAuth, webhooks,
  Oxygen, or embedded direct API access. Those keep working regardless.
- **Latency:** all Admin API calls take one extra hop; keeping the proxy in `iad`
  (same metro as Vercel `iad1`) minimizes it.
- **Destination lock:** squid is restricted to `*.myshopify.com`/`*.shopify.com`.
  If the app ever needs other server-side egress, open `squid.conf` and redeploy.
