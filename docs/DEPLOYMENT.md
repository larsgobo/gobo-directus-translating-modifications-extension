# Deploying to Directus on Easypanel (Hostinger VPS)

This repo is **only** the extension (`gobo-translations-grid`), not a full Directus install.

**Public vs private GitHub repo:** Both work. A private repo only hides source code; it does not fix SSH.

---

## What works today

| Workflow | Trigger | Result |
|----------|---------|--------|
| **Deploy extension** (`deploy.yml`) | Every push to `main` | **Full deploy** — zip, upload, Docker volume, restart (like old repo) |
| **CI build** (`build.yml`) | Pull requests only | Build + validate only (no VPS) |
| **Deploy extension (SSH)** | Manual only | SCP to host path; may timeout on port 22 |
| **Deploy extension (self-hosted)** | Manual (enable push later) | Full auto deploy when runner is on VPS |

### Why “Upload zip to VPS” fails (`dial tcp … i/o timeout`)

The zip step succeeded; GitHub **cannot open SSH** to your VPS.

**Most common causes (check in order):**

1. **Secrets not in this repo** — GitHub secrets are **per repository**. Values in `custom-directus-gobo` are **not** copied to `gobo-directus-translating-modifications-extension`. Re-create all five secrets in the **new** repo (Settings → Secrets → Actions).
2. **Wrong port** — copy `VPS_PORT` from the old repo (Hostinger often uses a non-22 port).
3. **Firewall** — Hostinger may block GitHub’s IP ranges even when your PC can SSH in.

Error:

```text
dial tcp <host>:<port>: i/o timeout
```

**If old repo still deploys from GitHub but this one does not:** compare secrets side-by-side in both repos (names and that all five exist in the new repo).

---

## Fastest fix when GitHub SSH times out

### A) Deploy from your PC (same as old `deploy.ps1`)

```powershell
cd "c:\Users\LarsThyregod\directus\custom extension\gobo-translation-modifications"
copy scripts\deploy.config.example.ps1 scripts\deploy.config.ps1
# Set DeploySshHost, DeploySshUser, DeploySshPort, DeploySshKeyPath, DeployDirectusVolumeName
.\scripts\deploy.ps1
```

Your PC can reach the VPS even when GitHub cannot.

### B) Build on the VPS (no inbound SSH from GitHub)

SSH to the server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/larsgobo/gobo-directus-translating-modifications-extension/main/scripts/vps-update-extension.sh -o /tmp/vps-update.sh
chmod +x /tmp/vps-update.sh
/tmp/vps-update.sh
docker service update --force gobo-dk-gtm_directus
```

If you see `npm: command not found`, the script uses Docker (`node:22-bookworm-slim`) to build automatically. Re-download the script after updates, or run:

```bash
docker run --rm -v /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications:/app -w /app node:22-bookworm-slim bash -ec "npm ci && npm run build"
chown -R 1000:1000 /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
docker service update --force gobo-dk-gtm_directus
```

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

## Option C: Reuse secrets from `custom-directus-gobo` (SSH deploy)

If your older Easypanel project already deploys via GitHub with these secrets, copy the **same values** into this repo:

| Secret (old repo) | Used for |
|-------------------|----------|
| `VPS_HOST` | Server IP |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Private key |
| `VPS_PORT` | SSH port — **often not 22 on Hostinger** |
| `DOCKER_VOLUME_NAME` | **Docker Swarm volume name** (see below) |

**Your server (confirmed):**

```text
/directus/extensions => gobo-dk-gtm_directus_extensions
```

Set `DOCKER_VOLUME_NAME` = `gobo-dk-gtm_directus_extensions`

Push to `main` runs **Deploy extension** — same pattern as your old `custom-directus-gobo` deploy.

For **Deploy extension (SSH)** (SCP to host path), use secret `DEPLOY_EXTENSIONS_PATH` instead:

```text
/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
```

Do **not** use `gobo-dk-gtm_directus_extensions` as `DOCKER_VOLUME_NAME` in the SCP workflow — that name is only for Docker volume mounts.

**Steps:**

1. GitHub → **gobo-directus-translating-modifications-extension** → Settings → Secrets → add the five secrets (copy values from `custom-directus-gobo`).
2. Push to `main` runs **Deploy extension** automatically, or Actions → **Deploy extension** → Run workflow.
3. Or deploy from your PC: copy `scripts/deploy.config.example.ps1` → `scripts/deploy.config.ps1`, then `.\scripts\deploy.ps1`.

**Local deploy (Windows, like old repo):**

```powershell
cd "c:\Users\LarsThyregod\directus\custom extension\gobo-translation-modifications"
copy scripts\deploy.config.example.ps1 scripts\deploy.config.ps1
# edit deploy.config.ps1 with VPS host, user, key path, volume name
.\scripts\deploy.ps1
```

You can keep `DEPLOY_*` secrets as aliases; the workflow prefers `VPS_*` when both exist.

---

## Option D: Open SSH port 22 for GitHub (advanced)

In Hostinger firewall, allow inbound **TCP 22** from GitHub Actions IP ranges:  
https://api.github.com/meta (see `actions` IPs)

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

1. **Settings → Extensions** → enable **Gobo Translations Grid** (`gobo-translation-modifications`)
2. Hard-refresh admin (Ctrl+Shift+R)

Translation fields should use interface `gobo-translations-grid` on `products`, `cms_pages`, `block_hero`, `block_richtext`.

**Note:** `@gobo/custom-extensions` / `products-translations-matrix` (disabled in your screenshot) is a **different** older bundle. This repo installs **`gobo-translation-modifications`** with interface id **`gobo-translations-grid`**.

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

1. Open latest green **Deploy extension** run on GitHub Actions (must show zip + VPS steps).
2. Download artifact **extension-dist**.
3. Upload `package.json` + `dist/` into the extensions folder on the server (SFTP / Easypanel file tools).
