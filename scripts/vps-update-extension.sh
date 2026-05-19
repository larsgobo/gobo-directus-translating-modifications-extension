#!/usr/bin/env bash
# Run ON the VPS (Easypanel host shell or SSH) to pull latest main and build.
# Uses Docker for npm when Node is not installed on the host (common on Easypanel VPS).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/larsgobo/gobo-directus-translating-modifications-extension.git}"
BRANCH="${BRANCH:-main}"
EXT_DIR="${EXT_DIR:-/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

echo "Extension directory: $EXT_DIR"

if [ ! -d "$EXT_DIR/.git" ]; then
  echo "Cloning repository..."
  mkdir -p "$(dirname "$EXT_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$EXT_DIR"
else
  echo "Pulling latest $BRANCH..."
  git -C "$EXT_DIR" fetch origin "$BRANCH"
  git -C "$EXT_DIR" reset --hard "origin/$BRANCH"
fi

cd "$EXT_DIR"

run_npm_build() {
  npm ci
  npm run build
  npm run validate
}

run_docker_build() {
  echo "npm not on host — building inside ${NODE_IMAGE}..."
  docker run --rm \
    -v "${EXT_DIR}:/app" \
    -w /app \
    "${NODE_IMAGE}" \
    bash -ec "npm ci && npm run build && npm run validate"
}

if command -v npm >/dev/null 2>&1; then
  run_npm_build
else
  run_docker_build
fi

# Directus container runs as uid 1000
if [ -d dist ]; then
  chown -R 1000:1000 "$EXT_DIR" 2>/dev/null || true
fi

echo ""
echo "Done. Verify:"
echo "  ls -la ${EXT_DIR}/package.json"
echo "  ls -la ${EXT_DIR}/dist/index.js"
echo ""
echo "Container path: /directus/extensions/gobo-translation-modifications/"
echo "Then: docker service update --force gobo-dk-gtm_directus"
echo "Enable Gobo Translations Grid in Directus Settings → Extensions."
