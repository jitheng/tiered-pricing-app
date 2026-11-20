# Shopify IP Allowlist — Static Egress Runbook (Fly.io + squid)

**Goal:** make every Shopify Admin API request from this app exit through a fixed
IP, allowlist that IP in Shopify, and enable enforcement — before the public-app
deadlines (**delist Nov 20 2026**, **full enforcement Apr 1 2027**).

**Why a proxy:** the app runs on Vercel serverless (region `iad1`); its egress
IPs come from a large, shifting pool and can't be enumerated into a CIDR.
Vercel's native static egress (Secure Compute) is Enterprise-only and this team
is not Enterprise. So we route outbound `fetch` through a self-hosted squid proxy
on Fly.io with a fixed IP, and allowlist that IP.

**Live deployment (iad):** app `tiered-pricing-egress` — ingress IPv4
`109.105.219.26` (app → proxy), **egress IPv4 `209.71.126.12` (the IP to
allowlist in Shopify)**.

> ⚠️ **Fly splits ingress and egress.** A dedicated IPv4 (`fly ips allocate-v4`)
> is **ingress only**; outbound defaults to a shared, changing NAT IP. You MUST
> also allocate an **app-scoped static egress IP** (`fly ips allocate-egress`)
> and allowlist *that* one. This cost us a debugging cycle — verified ingress
> `109.105.219.26` ≠ raw egress `152.233.83.21` until the egress IP was allocated.

**Cost:** ingress IPv4 $2/mo + static egress IPv4+IPv6 ~$3.60/mo + `shared-cpu-1x`
256MB $2.19/mo = **~$7.79/mo** (over Fly's $5 personal-org waiver, so it bills).
A $0 alternative (Oracle Cloud Always Free, `infra/egress-proxy/oracle/`) exists
but was blocked by no free-shape capacity in the home region when we tried.

**How the code hooks in:** `app/egress-proxy.server.ts` installs an undici
`ProxyAgent` global dispatcher when `SHOPIFY_EGRESS_PROXY_URL` is set (wired at
the top of `app/shopify.server.ts`). Off by default. Only `fetch` is proxied —
Prisma→Neon DB traffic is TCP and is never proxied.

The proxy lives in `infra/egress-proxy/` (Dockerfile, squid.conf, fly.toml).

---

## Deploy from scratch (reproducing the live app)

```bash
cd infra/egress-proxy
fly apps create tiered-pricing-egress --org personal
fly ips allocate-v4 --app tiered-pricing-egress            # ingress ($2/mo)
fly secrets set PROXY_USER=tiered PROXY_PASS="$(openssl rand -hex 24)" \
  --app tiered-pricing-egress                               # save the password
fly deploy --app tiered-pricing-egress --ha=false           # creates the machine

# The missing-piece step: app-scoped STATIC EGRESS IP (the IP Shopify sees)
fly ips allocate-egress --region iad --app tiered-pricing-egress   # ~$3.60/mo
fly machine restart <machine-id> --app tiered-pricing-egress       # pick it up
fly ips list --app tiered-pricing-egress                           # note egress v4
```

## Verify the egress IP (don't skip — allowlisting the wrong IP 403s prod)

The Fly SSH tunnel is unreliable for a one-off `curl`. The deterministic check is
to read the egress IP *through* the proxy by temporarily allowing an IP-echo host:

1. In `squid.conf`, append `api.ipify.org` to the `shopify_dst` dstdomain line.
2. `fly deploy --ha=false`.
3. `curl -s -x "http://tiered:PASS@<ingress-ip>:3128" https://api.ipify.org`
   → must print the **egress IPv4** (e.g. `209.71.126.12`).
4. Revert the `squid.conf` change and `fly deploy --ha=false` again.
5. Re-confirm lockdown: Shopify host → `200`, `api.ipify.org` → denied.

## TLS on the proxy connection (stunnel)

The proxy terminates TLS so the Vercel→proxy hop — including the basic-auth
`Proxy-Authorization` header — is encrypted. stunnel listens on `:3128` (TLS)
and forwards to squid on `127.0.0.1:3127`; squid is never exposed in plaintext.

- Cert is **self-signed** (SAN = ingress IP, 5-yr), pinned by the app — no domain
  or ACME needed. Public cert: `infra/egress-proxy/proxy-cert.pem`.
- Cert+key are Fly secrets (key never leaves Fly / the repo):
  `fly secrets set PROXY_TLS_CERT="$(cat proxy-cert.pem)" PROXY_TLS_KEY="$(cat proxy-key.pem)"`
- Regenerate (e.g. IP change):
  `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout proxy-key.pem -out proxy-cert.pem -days 1825 -subj "/CN=tiered-pricing-egress" -addext "subjectAltName=IP:<ingress-ip>"`
  then update the Fly secrets **and** the Vercel `SHOPIFY_EGRESS_PROXY_CA`.

## Wire into Vercel

Vercel → `tiered-pricing` → Settings → Environment Variables (Production,
**Sensitive**):
- `SHOPIFY_EGRESS_PROXY_URL=https://PROXY_USER:PROXY_PASS@<ingress-ip>:3128`
  (https scheme; host = the **ingress** IP)
- `SHOPIFY_EGRESS_PROXY_CA` = contents of `infra/egress-proxy/proxy-cert.pem`
  (pins the self-signed proxy cert; `\n`-escaped single line is fine)

Redeploy. Boot log prints
`[TieredPricing] Egress proxy enabled for outbound fetch (TLS proxy connection).`

## Shopify allowlist → test → enforce

Dev Dashboard → app → **API access → IP allowlist**: add the **egress** IP as a
`/32` (`209.71.126.12/32`). Use **test against recent traffic**; only when clean,
**enable enforcement**. Do Vercel + redeploy FIRST and confirm the app works, or
enforcement 403s your own app.

## Rollback

Unset `SHOPIFY_EGRESS_PROXY_URL` in Vercel + redeploy (direct egress), and/or
disable allowlist enforcement in Shopify.

---

## Gotchas

- **Allowlist the EGRESS IP, not the ingress/dedicated IPv4** (see the warning above).
- **Single point of failure:** every Admin API call goes through this one machine
  (`min_machines_running = 1`, always-on). Monitor `IP:3128`; `fly logs`.
- **squid-in-Docker quirks** (already handled in `squid.conf`/`docker-entrypoint.sh`):
  no `squid -z` (leaves a PID file → "already running"); `pid_filename none`;
  don't log to `/dev/stdout` (squid can't open it → use a file + `-d1` to stderr);
  `cache_effective_user proxy` (squid refuses to run as root).
- **Scope:** the allowlist covers Admin GraphQL/REST only — not OAuth, webhooks,
  Oxygen, or embedded direct API access.
- **Destination lock:** squid is restricted to `*.myshopify.com`/`*.shopify.com`.
- **Fly account gotchas:** new accounts need a saved payment method (not just the
  verification hold) before app creation, and may hit "high-risk-unlock".
