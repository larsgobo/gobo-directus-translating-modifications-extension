# Deploying to Directus on Easypanel (Hostinger VPS)

This repo is **only** the extension (`gobo-translations-grid`), not a full Directus install.

**Public vs private GitHub repo:** Both work. A private repo only hides source code; it does not fix SSH.

---

## What works today

| Workflow | Trigger | Result |
|----------|---------|--------|
| **Build extension** (`deploy.yml`) | Every push to `main` | Builds + validates + uploads artifact (should be green) |
| **Deploy extension (SSH)** | Manual only | Often fails: `dial tcp :22: i/o timeout` |
| **Deploy extension (self-hosted)** | Manual (enable push later) | Full auto deploy when runner is on VPS |

### Why SSH deploy fails from GitHub

GitHub Actions runners connect **from the internet** to your VPS on port **22**. Hostinger / Easypanel often **block inbound SSH** from GitHub’s IPs. Your PC may still SSH in; GitHub cannot.

Error you saw:

```text
dial tcp <host>:22: i/o timeout
```

This is a **firewall / network** issue, not wrong `DEPLOY_EXTENSIONS_PATH`.

---

## Recommended: deploy on the VPS (git pull + build)

Run once on the **VPS host** (Hostinger SSH or Easypanel host shell), then again after each release.

### Paths

| Location | Path |
|----------|------|
| Host (deploy target) | `/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications` |
| Container | `/directus/extensions/gobo-translation-modifications/` |

### One-time setup

```bash
# On the VPS host (needs git + node 22)
curl -fsSL https://raw.githubusercontent.com/larsgobo/gobo-directus-translating-modifications-extension/main/scripts/vps-update-extension.sh -o /tmp/vps-update-extension.sh
chmod +x /tmp/vps-update-extension.sh
EXT_DIR=/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications /tmp/vps-update-extension.sh
```

Or clone manually:

```bash
mkdir -p /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions
git clone https://github.com/larsgobo/gobo-directus-translating-modifications-extension.git \
  /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
cd /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
npm ci && npm run build
```

### After each push to `main`

```bash
EXT_DIR=/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
git -C "$EXT_DIR" pull origin main
cd "$EXT_DIR" && npm ci && npm run build
```

Optional cron (every 15 min auto-pull):

```bash
crontab -e
# add:
*/15 * * * * cd /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications && git pull -q && npm ci --silent && npm run build --silent
```

### Verify in Directus container console

```bash
ls -la /directus/extensions/gobo-translation-modifications/package.json
ls -la /directus/extensions/gobo-translation-modifications/dist/index.js
```

---

## Option B: Self-hosted GitHub runner (fully automatic)

1. On the VPS, [install a GitHub Actions self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners) for this repo.
2. Label it: `easypanel`
3. In `.github/workflows/deploy-self-hosted.yml`, uncomment `push: branches: [main]`.
4. Keep `DEPLOY_EXTENSIONS_PATH` secret set.
5. Run workflow **Deploy extension (self-hosted runner)** from Actions.

The runner copies files locally (no port 22 from GitHub).

---

## Option C: Open SSH for GitHub (advanced)

In Hostinger firewall, allow inbound **TCP 22** from GitHub Actions IP ranges (changes often):  
https://api.github.com/meta (see `actions` IPs)

Then run **Actions → Deploy extension (SSH) → Run workflow** manually.

---

## Easypanel storage

| Volume name | Container path |
|-------------|----------------|
| `extensions` | `/directus/extensions` |

Recommended env on **directus** service:

```env
EXTENSIONS_AUTO_RELOAD=true
```

---

## Enable in Directus

1. **Settings → Extensions** → enable **Gobo Translations Grid**
2. Hard-refresh admin (Ctrl+Shift+R)

Translation fields should use interface `gobo-translations-grid` on `products`, `cms_pages`, `block_hero`, `block_richtext`.

---

## GitHub secrets (for SSH or self-hosted deploy only)

| Secret | Value |
|--------|--------|
| `DEPLOY_EXTENSIONS_PATH` | `/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications` |
| `DEPLOY_HOST` | VPS IP (e.g. `168.231.108.8`) |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private key PEM |
| `DEPLOY_SSH_PORT` | `22` or Hostinger custom port |
| `EASYPANEL_DEPLOY_WEBHOOK` | Optional Easypanel deploy webhook |

Not required for the **git pull on VPS** method.

---

## Download build artifact (no VPS script)

1. Open latest green **Build extension** run on GitHub Actions.
2. Download artifact **extension-dist**.
3. Upload `package.json` + `dist/` into the extensions folder on the server (SFTP / Easypanel file tools).
