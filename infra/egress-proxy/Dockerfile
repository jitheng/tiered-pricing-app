# Static-IP forward proxy (squid) for Shopify Admin API egress.
# Deployed to Fly.io with a dedicated IPv4; that IP is allowlisted in Shopify.
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends squid apache2-utils \
  && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3128
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
