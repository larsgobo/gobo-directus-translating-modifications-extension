# Deploying to Directus on Easypanel (Hostinger VPS)

This repo is **only** the extension (`gobo-translations-grid`), not a full Directus install.

**Public vs private GitHub repo:** Both work. A private repo only hides source code; it does not fix SSH.

---

## What works today

| Workflow | Trigger | Result |
|----------|---------|--------|
| **Build extension** (`deploy.yml`) | Every push to `main` | **Build only** — green check does **not** deploy to VPS |
| **Deploy extension (Docker volume)** | Manual | **Deploy** — same steps as old `custom-directus-gobo` / `deploy.ps1` |
| **Deploy extension (SSH)** | Manual only | SCP to host path; may timeout on port 22 |
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

Use workflow **Deploy extension (Docker volume)** — same pattern as your old `custom-directus-gobo` deploy.

For **Deploy extension (SSH)** (SCP to host path), use secret `DEPLOY_EXTENSIONS_PATH` instead:

```text
/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
```

Do **not** use `gobo-dk-gtm_directus_extensions` as `DOCKER_VOLUME_NAME` in the SCP workflow — that name is only for Docker volume mounts.

**Steps:**

1. GitHub → **gobo-directus-translating-modifications-extension** → Settings → Secrets → add the five secrets (copy values from `custom-directus-gobo`).
2. Actions → **Deploy extension (Docker volume)** → **Run workflow** (not “Build extension”).
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

1. Open latest green **Build extension** run on GitHub Actions.
2. Download artifact **extension-dist**.
3. Upload `package.json` + `dist/` into the extensions folder on the server (SFTP / Easypanel file tools).
