#!/usr/bin/env bash
# Run on the VPS (Easypanel host shell or SSH) to confirm extension paths.
set -euo pipefail

PROJECT="gobo-dk-gtm"
SERVICE="directus"
VOLUME="extensions"
EXT_NAME="gobo-translation-modifications"

HOST_VOLUME="/etc/easypanel/projects/${PROJECT}/${SERVICE}/volumes/${VOLUME}"
DEPLOY_PATH="${HOST_VOLUME}/${EXT_NAME}"
CONTAINER_PATH="/directus/extensions/${EXT_NAME}"

echo "=== Easypanel volume (host) ==="
echo "Expected: ${HOST_VOLUME}"
if [ -d "$HOST_VOLUME" ]; then
  echo "OK: volume directory exists"
  ls -la "$HOST_VOLUME"
else
  echo "MISSING: create the volume in Easypanel Storage first"
  exit 1
fi

echo ""
echo "=== Extension deploy target (GitHub DEPLOY_EXTENSIONS_PATH) ==="
echo "Use this secret value:"
echo "  ${DEPLOY_PATH}"
mkdir -p "$DEPLOY_PATH"
ls -la "$DEPLOY_PATH" || true

echo ""
echo "=== Directus container path (after deploy) ==="
echo "Expected: ${CONTAINER_PATH}/package.json"
echo "Expected: ${CONTAINER_PATH}/dist/index.js"
