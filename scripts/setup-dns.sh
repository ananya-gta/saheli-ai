#!/usr/bin/env bash
# Point saheliai.com, www and every business subdomain (*.saheliai.com) at this server, using GoDaddy's gddy CLI.
#   ./scripts/setup-dns.sh                 (detects this server's public IP)
#   ./scripts/setup-dns.sh 203.0.113.10    (or pass the IP)
# Only A records for @, www and * are replaced. MX/TXT records (your Titan email) are not touched.
set -euo pipefail
DOMAIN="${DOMAIN:-saheliai.com}"
IP="${1:-$(curl -fsS --max-time 10 https://api.ipify.org)}"
command -v gddy >/dev/null || { echo "gddy not installed: curl -fsSL https://github.com/godaddy/cli/releases/latest/download/install.sh | bash"; exit 1; }
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "ERROR: '$IP' is not an IPv4 address"; exit 1; }

echo "==> $DOMAIN -> $IP"
for name in "@" "www" "*"; do
  echo "   A $name"
  gddy dns set "$DOMAIN" --type A --name "$name" --data "$IP" --ttl 600
done
echo "==> Current A records"
gddy dns list "$DOMAIN" --type A
echo "==> Check (may take a few minutes to spread):  dig +short $DOMAIN  dig +short demo-bakery.$DOMAIN"
