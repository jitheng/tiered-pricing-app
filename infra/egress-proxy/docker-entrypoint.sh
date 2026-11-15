#!/bin/sh
# Generate the squid password file from Fly secrets at container start, so the
# credentials are never baked into the image. Then run squid in the foreground.
set -e

: "${PROXY_USER:?PROXY_USER not set — run: fly secrets set PROXY_USER=...}"
: "${PROXY_PASS:?PROXY_PASS not set — run: fly secrets set PROXY_PASS=...}"

htpasswd -bc /etc/squid/passwords "$PROXY_USER" "$PROXY_PASS" >/dev/null 2>&1

# Initialise cache/swap dirs (harmless even though caching is disabled).
squid -z >/dev/null 2>&1 || true

# -N: no daemon (foreground, required for containers). -d1: log to stdout.
exec squid -N -d1
