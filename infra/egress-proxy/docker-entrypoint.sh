#!/bin/sh
# Generate the squid password file from Fly secrets at container start, so the
# credentials are never baked into the image. Then run squid in the foreground.
set -e

: "${PROXY_USER:?PROXY_USER not set — run: fly secrets set PROXY_USER=...}"
: "${PROXY_PASS:?PROXY_PASS not set — run: fly secrets set PROXY_PASS=...}"

htpasswd -bc /etc/squid/passwords "$PROXY_USER" "$PROXY_PASS" >/dev/null 2>&1

# No cache_dir is configured (caching is disabled), so swap-dir init (`squid -z`)
# is unnecessary — and running it first leaves a PID file that makes the real
# `squid -N` abort with "Squid is already running". Start squid directly.
# -N: no daemon (foreground, required for containers). -d1: log to stdout.
exec squid -N -d1
