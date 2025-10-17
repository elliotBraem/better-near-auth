#!/bin/sh

set -euo pipefail

# strip https:// or http:// from domain if necessary
export APP_HOST=${APP_DOMAIN##*://}

echo "Using API: ${API_DOMAIN} with port: ${API_PORT}"
echo "Using APP: ${APP_DOMAIN}"

exec caddy run --config Caddyfile --adapter caddyfile 2>&1
