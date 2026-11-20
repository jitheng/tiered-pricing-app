# Egress proxy (Fly.io + squid)

A tiny static-IP forward proxy so the tiered-pricing app's Shopify Admin API
calls exit from **one fixed IP** that can be allowlisted in Shopify's Dev
Dashboard (API access → IP allowlist). See the top-level
`docs/ip-allowlist-runbook.md` for how this fits the overall compliance task.

- **Cost:** ~$2/mo for the dedicated IPv4. The `shared-cpu-1x` machine is within
  Fly's free allowance range; only the dedicated IPv4 is billed.
- **Security:** basic-auth required (creds via Fly secrets, never in the image),
  HTTPS-CONNECT only, destinations restricted to `*.myshopify.com` / `*.shopify.com`.

## Files
- `Dockerfile` — debian + squid.
- `squid.conf` — auth + Shopify-only access rules.
- `docker-entrypoint.sh` — builds the htpasswd from `PROXY_USER`/`PROXY_PASS` at start.
- `fly.toml` — raw TCP service on `3128`, region `iad`, always-on.

## Deploy (run from this directory)

```bash
cd infra/egress-proxy

# 1. Create the app (pick a unique name; update `app` in fly.toml to match).
fly apps create tiered-pricing-egress

# 2. Allocate a DEDICATED IPv4 — this is the ~$2/mo line item and the IP you
#    will allowlist in Shopify. Note the address it prints.
fly ips allocate-v4 --app tiered-pricing-egress

# 3. Set proxy credentials (choose a strong password).
fly secrets set PROXY_USER=tiered PROXY_PASS="$(openssl rand -hex 24)" --app tiered-pricing-egress
#    Save the password — you need it for SHOPIFY_EGRESS_PROXY_URL.

# 4. Deploy.
fly deploy --app tiered-pricing-egress

# 5. Confirm the dedicated IPv4 (the `v4` row that is NOT "shared").
fly ips list --app tiered-pricing-egress
```

## Verify it works

```bash
# Replace USER:PASS and 203.0.113.10 with your values. Should print the Fly IP.
curl -s -x "http://USER:PASS@203.0.113.10:3128" https://api.ipify.org ; echo

# A Shopify host should tunnel (200/301/4xx from Shopify = proxy worked);
# a non-Shopify host should be DENIED by squid (403), proving the allowlist.
curl -s -o /dev/null -w "shopify:%{http_code}\n" -x "http://USER:PASS@203.0.113.10:3128" https://admin.shopify.com
curl -s -o /dev/null -w "other:%{http_code}\n"   -x "http://USER:PASS@203.0.113.10:3128" https://example.com
```

## Wire it into the app
In **Vercel → `tiered-pricing` → Settings → Environment Variables** (Production):

```
SHOPIFY_EGRESS_PROXY_URL=http://USER:PASS@203.0.113.10:3128
```

Use the **dedicated IPv4** as the host (the `*.fly.dev` name only works for
Fly-proxied HTTP, not this raw TCP port). Redeploy the app, then add that same
IPv4 as a `/32` CIDR to the Shopify allowlist and enable enforcement (see the
top-level runbook for the test-then-enforce order).

## Operational notes
- **Single point of failure:** every Admin API call goes through this box. It's
  set to always-on (`min_machines_running = 1`). Point an uptime monitor at the
  IP:3128 and/or watch `fly logs`.
- **Rollback:** unset `SHOPIFY_EGRESS_PROXY_URL` in Vercel + redeploy to go back
  to direct egress.
- **Open up destinations** (if the app ever needs non-Shopify egress): edit
  `squid.conf` — comment the `shopify_dst` term in the allow rule — and redeploy.
