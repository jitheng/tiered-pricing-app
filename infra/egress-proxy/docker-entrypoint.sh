#!/bin/sh
# Start the egress proxy: squid (plaintext, localhost:3127) behind stunnel
# (TLS, 0.0.0.0:3128). Credentials and the TLS cert/key come from Fly secrets
# at container start, so nothing sensitive is baked into the image.
set -e

: "${PROXY_USER:?PROXY_USER not set — run: fly secrets set PROXY_USER=...}"
: "${PROXY_PASS:?PROXY_PASS not set — run: fly secrets set PROXY_PASS=...}"
: "${PROXY_TLS_CERT:?PROXY_TLS_CERT not set — run: fly secrets set PROXY_TLS_CERT=...}"
: "${PROXY_TLS_KEY:?PROXY_TLS_KEY not set — run: fly secrets set PROXY_TLS_KEY=...}"

# squid basic-auth password file.
htpasswd -bc /etc/squid/passwords "$PROXY_USER" "$PROXY_PASS" >/dev/null 2>&1

# TLS material for stunnel (key kept private).
printf '%s\n' "$PROXY_TLS_CERT" > /etc/stunnel/proxy-cert.pem
printf '%s\n' "$PROXY_TLS_KEY"  > /etc/stunnel/proxy-key.pem
chmod 600 /etc/stunnel/proxy-key.pem

# Start squid in the background (listens on 127.0.0.1:3127). No `squid -z`:
# there's no cache_dir, and it would leave a PID file that aborts the real start.
squid -N -d1 &
SQUID_PID=$!

# Give squid a moment to bind; if it died immediately, fail fast so Fly restarts.
sleep 2
if ! kill -0 "$SQUID_PID" 2>/dev/null; then
  echo "[egress-proxy] squid failed to start" >&2
  exit 1
fi

# stunnel runs in the foreground as PID 1's child and terminates TLS on :3128.
exec stunnel /etc/stunnel/stunnel.conf
