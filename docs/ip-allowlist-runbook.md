# Shopify IP Allowlist — Static Egress Runbook (QuotaGuard Static)

**Goal:** make every Shopify Admin API request from this app exit through a fixed
IP, allowlist that IP in Shopify, and enable enforcement — before the public-app
deadlines (**delist Nov 20 2026**, **full enforcement Apr 1 2027**).

**Why a proxy:** the app runs on Vercel serverless (region `iad1`); its egress
IPs come from a large, shifting pool and can't be enumerated into a CIDR.
Vercel's native static egress (Secure Compute) is Enterprise-only and this team
is not Enterprise. So we route outbound `fetch` through QuotaGuard Static, which
gives a small set of fixed IPs we can allowlist.

**How the code hooks in:** `app/egress-proxy.server.ts` installs an undici
`ProxyAgent` global dispatcher when `SHOPIFY_EGRESS_PROXY_URL` is set (wired at
the top of `app/shopify.server.ts`). Off by default. Only `fetch` is proxied —
Prisma→Neon DB traffic is TCP and is never proxied.

---

## Steps

### 1. Provision QuotaGuard Static
- Sign up at <https://www.quotaguard.com> (or add the add-on if you deploy via a
  platform that offers it). Choose a **Static** plan (not QuotaGuard Shield).
- Prefer a region close to `iad1` (US-East) to minimize added latency.
- On provisioning you get a `QUOTAGUARD_URL` of the form
  `http://USER:PASS@us-east-static-NN.quotaguard.com:9293` and a list of
  **outbound static IPs** (usually 2) in the QuotaGuard dashboard.

### 2. Set the env var in Vercel
Vercel → Project `tiered-pricing` → Settings → Environment Variables:
- **Key:** `SHOPIFY_EGRESS_PROXY_URL`
- **Value:** the `QUOTAGUARD_URL` from step 1
- **Environments:** Production (add Preview too if you want preview deploys to
  reach Shopify). Redeploy so the new env is picked up.

> Never commit the real value — it embeds proxy credentials.

### 3. Verify egress actually exits via QuotaGuard
After redeploy, confirm the app's outbound IP matches QuotaGuard's static IPs.
Quick check with the same proxy from a shell (replace with your URL):
```bash
curl -s -x "http://USER:PASS@us-east-static-01.quotaguard.com:9293" https://api.ipify.org
```
The returned IP must be one of QuotaGuard's published static IPs. In the running
app, a successful Admin API call (e.g. load the dashboard, which lists rules)
confirms the path end-to-end; the boot log prints
`[TieredPricing] Egress proxy enabled for outbound fetch.`

### 4. Add the IP(s) to Shopify's allowlist
Shopify Dev Dashboard → your app → **API access → IP allowlist**:
- Add each QuotaGuard static IP as a `/32` CIDR (e.g. `203.0.113.7/32`). Add
  **all** of them — QuotaGuard rotates between its static IPs.
- (Optional) QuotaGuard's ASN can be added instead of/in addition to IPs, but
  prefer explicit `/32`s for a tight allowlist.

### 5. Test against recent traffic, then enforce
- Use the dashboard's **test against recent traffic** tool first — it flags any
  request that would be blocked by the allowlist. Expect all app traffic to show
  the QuotaGuard IP.
- Only once it's clean, **enable enforcement**. Enabling before step 3/4 are
  verified will 403 your own app.

### 6. Rollback
If anything breaks: **unset `SHOPIFY_EGRESS_PROXY_URL` in Vercel and redeploy**
(reverts to direct egress), and/or disable allowlist enforcement in Shopify.

---

## Gotchas
- **IP must match:** the proxy's outbound IP and the Shopify-allowlisted IP have
  to be the same set, or you self-403.
- **All static IPs:** allowlist every IP QuotaGuard lists, not just the first.
- **Scope:** the allowlist covers Admin GraphQL/REST only — not OAuth, webhooks,
  Oxygen, or embedded direct API access. Those keep working regardless.
- **Latency/limits:** all Admin API calls now take one extra proxy hop, and
  QuotaGuard plans meter request volume — size the plan to the app's call volume
  (analytics order scans are the heaviest path).
