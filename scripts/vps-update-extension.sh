#!/usr/bin/env bash
# Run ON the VPS (Easypanel host shell or SSH from your PC) to pull latest main and build.
# Does not require GitHub Actions to reach your server on port 22.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/larsgobo/gobo-directus-translating-modifications-extension.git}"
BRANCH="${BRANCH:-main}"
EXT_DIR="${EXT_DIR:-/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications}"

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
npm ci
npm run build
npm run validate

echo ""
echo "Done. Container path:"
echo "  /directus/extensions/gobo-translation-modifications/"
echo ""
echo "Enable Gobo Translations Grid in Directus Settings → Extensions, then hard-refresh the admin."
