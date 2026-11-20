#!/usr/bin/env bash
# Configure a fresh Ubuntu 22.04 Oracle Cloud Always Free VM as the Shopify
# Admin API egress proxy (squid, basic auth, Shopify-only destinations).
#
# Run ON the VM as root, from this directory:
#   sudo PROXY_USER=tiered PROXY_PASS='<strong-password>' bash setup.sh
#
# Afterwards the proxy URL is:  http://PROXY_USER:PROXY_PASS@<vm-public-ip>:3128
# On a normal VM the public IP is also the egress IP, so that's the IP you
# allowlist in Shopify.
set -euo pipefail

: "${PROXY_USER:?set PROXY_USER (e.g. PROXY_USER=tiered)}"
: "${PROXY_PASS:?set PROXY_PASS (a strong password)}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> Installing squid + tools"
apt-get update -qq
apt-get install -y -qq squid apache2-utils curl

echo "==> Writing proxy credentials"
htpasswd -bc /etc/squid/passwords "$PROXY_USER" "$PROXY_PASS"
chmod 644 /etc/squid/passwords

echo "==> Installing squid.conf"
[ -f /etc/squid/squid.conf.orig ] || cp /etc/squid/squid.conf /etc/squid/squid.conf.orig
cp "$SCRIPT_DIR/squid.conf" /etc/squid/squid.conf

echo "==> Opening port 3128 in the host firewall (iptables)"
# Oracle's Ubuntu images ship restrictive iptables (only SSH open). Insert an
# accept rule for 3128 before the catch-all REJECT and persist it.
if ! iptables -C INPUT -p tcp --dport 3128 -j ACCEPT 2>/dev/null; then
  iptables -I INPUT -p tcp --dport 3128 -j ACCEPT
fi
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  apt-get install -y -qq iptables-persistent
fi
netfilter-persistent save

echo "==> Restarting squid"
systemctl restart squid
systemctl enable squid

echo "==> Done. Verifying egress IP (this box's public IP should match):"
curl -s --max-time 15 https://api.ipify.org || true
echo
echo "Remember: also open ingress TCP 3128 in the VCN Security List / NSG in the"
echo "Oracle console, or external clients can't reach the proxy."
