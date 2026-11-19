# Shopify IP Allowlist — Static Egress Runbook (Oracle Cloud Always Free + squid)

**Goal:** make every Shopify Admin API request from this app exit through a fixed
IP, allowlist that IP in Shopify, and enable enforcement — before the public-app
deadlines (**delist Nov 20 2026**, **full enforcement Apr 1 2027**).

**Why a proxy:** the app runs on Vercel serverless (region `iad1`); its egress
IPs come from a large, shifting pool and can't be enumerated into a CIDR.
Vercel's native static egress (Secure Compute) is Enterprise-only and this team
is not Enterprise. So we route outbound `fetch` through a self-hosted squid proxy
on a VM with a fixed public IP, and allowlist that IP.

**Why Oracle Cloud (not Fly):** on a normal cloud VM the single public IP serves
**both ingress and egress**, so the IP we allowlist is the IP Shopify sees. Fly
was rejected because its dedicated IPv4 is ingress-only and egress NATs through a
shared, changing IP (verified: ingress `137.66.46.22` vs egress `152.233.83.21`),
and a stable Fly egress IP costs extra (~$7.79/mo total). Oracle's **Always Free**
tier is $0/mo. (QuotaGuard Static dropped its free tier, hence self-hosting.)

> History: the earlier Fly.io + squid config (Dockerfile, fly.toml, etc.) is
> preserved in git history (commit "preserve working Fly proxy config") for
> future review; it was removed from the working tree on the pivot to Oracle.

**How the code hooks in:** `app/egress-proxy.server.ts` installs an undici
`ProxyAgent` global dispatcher when `SHOPIFY_EGRESS_PROXY_URL` is set (wired at
the top of `app/shopify.server.ts`). Off by default. Only `fetch` is proxied —
Prisma→Neon DB traffic is TCP and is never proxied.

The VM provisioning lives in `infra/egress-proxy/oracle/` (`squid.conf`, `setup.sh`).

---

## Steps

### 1. Create the Oracle VM (console — your part)

1. Sign up at <https://cloud.oracle.com> → "Start for free" (a card is required
   for **identity verification only**; Always Free resources aren't charged).
2. **Compute → Instances → Create Instance**: image **Ubuntu 22.04**, an
   **Always Free eligible** shape (`VM.Standard.A1.Flex` 1 OCPU/6GB, or
   `VM.Standard.E2.1.Micro`). Paste the SSH **public key**
   (`~/.ssh/oracle_egress_proxy.pub`). Create; note the **public IP**.
3. Open ingress TCP **3128** at the cloud level: the instance's **subnet →
   Security List** (or an NSG) → **Add Ingress Rule**: source `0.0.0.0/0`,
   protocol TCP, destination port `3128`.

### 2. Configure the proxy (server — I run this)

Copy the config onto the VM and run the setup script as root with a generated
password:

```bash
IP=<vm-public-ip>
scp -i ~/.ssh/oracle_egress_proxy infra/egress-proxy/oracle/{squid.conf,setup.sh} ubuntu@$IP:/tmp/
ssh -i ~/.ssh/oracle_egress_proxy ubuntu@$IP \
  "cd /tmp && sudo PROXY_USER=tiered PROXY_PASS='$(openssl rand -hex 24)' bash setup.sh"
```

`setup.sh` installs squid + the Shopify-only config, writes the htpasswd, opens
the host firewall (iptables) for 3128, and prints the box's egress IP.

### 3. Verify egress == the VM's public IP

```bash
# Should print the VM's public IP (proves no ingress/egress split):
curl -s -x "http://tiered:PASS@$IP:3128" https://www.shopify.com -o /dev/null -w "%{http_code}\n"
# Non-Shopify host must be denied (403) by the allowlist:
curl -s -x "http://tiered:PASS@$IP:3128" https://example.com -o /dev/null -w "%{http_code}\n"
```

### 4. Set the env var in Vercel

Vercel → Project `tiered-pricing` → Settings → Environment Variables:
`SHOPIFY_EGRESS_PROXY_URL=http://tiered:PASS@<vm-public-ip>:3128` (Production;
add Preview if desired). Redeploy. Boot log prints
`[TieredPricing] Egress proxy enabled for outbound fetch.`

### 5. Add the IP to Shopify's allowlist, test, enforce

Shopify Dev Dashboard → app → **API access → IP allowlist**: add
`<vm-public-ip>/32`. Use **test against recent traffic** first; only when clean,
**enable enforcement** (doing it before steps 2–4 are verified 403s your app).

### 6. Rollback

Unset `SHOPIFY_EGRESS_PROXY_URL` in Vercel + redeploy (direct egress), and/or
disable allowlist enforcement in Shopify.

---

## Gotchas

- **IP must match:** on a normal VM the public IP is also the egress IP — verify
  in step 3 before allowlisting.
- **Two firewalls:** Oracle needs BOTH the host iptables rule (`setup.sh`) and
  the VCN Security List / NSG ingress rule (console) open on 3128.
- **Single point of failure:** every Admin API call goes through this one VM.
  Point an uptime monitor at `IP:3128`; `sudo systemctl status squid` on the box.
- **Scope:** the allowlist covers Admin GraphQL/REST only — not OAuth, webhooks,
  Oxygen, or embedded direct API access.
- **Destination lock:** squid is restricted to `*.myshopify.com`/`*.shopify.com`
  (`oracle/squid.conf`); open it up there + reload squid if other egress is needed.
