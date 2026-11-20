# Static-IP forward proxy for Shopify Admin API egress.
# Deployed to Fly.io; the app-scoped EGRESS IPv4 is allowlisted in Shopify.
# stunnel terminates TLS on :3128 and forwards to squid on 127.0.0.1:3127, so
# the proxy connection (incl. the Proxy-Authorization header) is encrypted.
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends squid apache2-utils stunnel4 \
  && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf
COPY stunnel.conf /etc/stunnel/stunnel.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3128
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
