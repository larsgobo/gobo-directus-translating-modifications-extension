# Deploying to Directus on Easypanel (Hostinger VPS)

This repo is **only** the extension (`gobo-translations-grid`), not a full Directus install. You deploy the built `dist/` folder into your existing Directus **extensions** directory on the VPS.

**Public vs private GitHub repo:** Both work. Deployment uses [GitHub Actions secrets](https://github.com/larsgobo/gobo-directus-translating-modifications-extension/settings/secrets/actions)—no need to make the repo private unless you want to hide the source code.

---

## Overview

```text
GitHub (push to main)
    → GitHub Actions: npm build + validate
    → SCP to VPS extensions folder
    → (optional) Easypanel deploy webhook
    → Directus loads extension (auto-reload or restart)
```

---

## Step 1: Extensions volume in Easypanel

You already have this (Storage tab):

| Volume name | Container path |
|-------------|----------------|
| `extensions` | `/directus/extensions` |

No extra mount is required. Each extension lives in a **subfolder** under `/directus/extensions/`, e.g. `gobo-translation-modifications/`.

If the `extensions` volume is missing, add a **Volume** mount with name `extensions` and path `/directus/extensions`, then redeploy `directus`.

5. **Host path on the VPS** (Easypanel standard — [docs](https://easypanel.io/docs/services/app#mounts)):

   ```text
   /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions
   ```

   Your Storage tab already has a volume named **`extensions`** → `/directus/extensions`.

6. **GitHub secret `DEPLOY_EXTENSIONS_PATH`** must be the **extension subfolder** inside that volume:

   ```text
   /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
   ```

   After deploy, the container sees:

   ```text
   /directus/extensions/gobo-translation-modifications/package.json
   /directus/extensions/gobo-translation-modifications/dist/index.js
   ```

### Verify the path (no SSH required)

Use **Easypanel → gobo-dk-gtm → directus → Console** (or Terminal icon on the service):

```bash
# Host path (run on the VPS host — use Easypanel "Launcher" / host shell if available)
ls -la /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/

# Inside the Directus container
ls -la /directus/extensions/
```

If the host path exists, create the extension folder once:

```bash
mkdir -p /etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications
```

From **inside the Directus container** console:

```bash
ls -la /directus/extensions/gobo-translation-modifications/
```

### Recommended Directus env (optional)

In Easypanel → **directus** → **Environment**, add if not already set:

```env
EXTENSIONS_AUTO_RELOAD=true
```

Then extension updates apply without a full container restart after each deploy.

---

## Step 2: Enable the extension in Directus

After the first deploy:

1. **Settings → Extensions** in the Data Studio.
2. Enable **Gobo Translations Grid**.
3. Hard-refresh the browser (Ctrl+Shift+R).

Translation fields on `products`, `cms_pages`, `block_hero`, and `block_richtext` should already use interface `gobo-translations-grid` (configured via Directus MCP).

---

## Step 3: GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Example | Required |
|--------|---------|----------|
| `DEPLOY_HOST` | `168.231.108.8` | Yes |
| `DEPLOY_USER` | `root` or your SSH user | Yes |
| `DEPLOY_SSH_KEY` | Private key (full PEM contents) | Yes |
| `DEPLOY_EXTENSIONS_PATH` | `/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/extensions/gobo-translation-modifications` | Yes |
| `DEPLOY_SSH_PORT` | `22` | No (default 22) |
| `EASYPANEL_DEPLOY_WEBHOOK` | Deploy webhook URL from Easypanel | No |

### SSH key on Hostinger

1. Generate a key pair (on your PC):

   ```bash
   ssh-keygen -t ed25519 -C "github-deploy-gobo-extension" -f ./gobo-extension-deploy
   ```

2. Add the **public** key (`gobo-extension-deploy.pub`) to the VPS:
   - Hostinger hPanel → SSH keys, or
   - `~/.ssh/authorized_keys` on the server.

3. Paste the **private** key into GitHub secret `DEPLOY_SSH_KEY`.

### Easypanel deploy webhook (optional)

1. Easypanel → **directus** → **Deployments**.
2. Copy the **Deploy webhook** / trigger URL.
3. Add as GitHub secret `EASYPANEL_DEPLOY_WEBHOOK`.

Only needed if `EXTENSIONS_AUTO_RELOAD` is off or changes do not appear until redeploy.

---

## Step 4: Run a deploy

**Automatic:** Push to `main` (workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)).

**Manual:** GitHub → **Actions** → **Build and deploy extension** → **Run workflow**.

**Local (without GitHub):**

```bash
npm run build
# Copy package.json + dist/ to DEPLOY_EXTENSIONS_PATH on the server, e.g.:
scp -r package.json dist user@168.231.108.8:/etc/easypanel/projects/gobo-dk-gtm/directus/volumes/custom-extensions/
```

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Extension not listed | `package.json` + `dist/index.js` exist on server; path matches mount |
| Old UI (2 columns) | Field interface is `gobo-translations-grid`; hard-refresh browser |
| Action fails on SCP | SSH key, host, user, `DEPLOY_EXTENSIONS_PATH`; directory exists |
| Permission denied | SSH user can write to extensions volume path |

---

## Alternative: Easypanel Git on Directus service

Easypanel **Source → GitHub** on the `directus` service rebuilds the **whole Directus app** from a repo with a Dockerfile. That is **not** this extension repo.

Use **GitHub Actions + SCP** (this guide) for extension-only deploys, or bake extensions into a custom Directus Docker image in a separate infra repo.
