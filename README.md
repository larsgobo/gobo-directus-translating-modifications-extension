# gobo-translation-modifications

Directus **interface** extension that shows **all translation languages side-by-side** in a horizontal grid (instead of the built-in 2-column split view).

**Repository:** [github.com/larsgobo/gobo-directus-translating-modifications-extension](https://github.com/larsgobo/gobo-directus-translating-modifications-extension)

## Features

- One column per language from your `languages` collection (e.g. da-DK, en-US, fi-FI, sv-SE)
- Horizontal scroll on smaller viewports
- Same enable/delete and field editors as the core translations interface
- Configurable column min width

## Setup

```bash
npm install
npm run build
```

Deploy `dist/` to your Directus `extensions/` folder, or use:

```bash
npm run link
```

Enable **Gobo Translations Grid** under Settings → Extensions, then hard-refresh the Data Studio.

## Deploy (Easypanel / VPS)

- **Deploy:** Every push to `main` runs **Deploy extension** (build, zip, upload to VPS, restart Directus).
- **Deploy:** GitHub cannot SSH to most Hostinger VPS instances (`port 22 timeout`). Use **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — recommended: run `scripts/vps-update-extension.sh` on the server, or install a self-hosted runner.

## Assign the interface

For each collection with a `translations` field:

1. Settings → Data Model → collection → `translations` field
2. Interface → **Gobo Translations Grid**
3. Save

Configured in Gobo for: `products`, `cms_pages`, `block_hero`, `block_richtext`.

## Development

```bash
npm run dev
```

Set `EXTENSIONS_AUTO_RELOAD=true` on Directus during local development.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Production build (`dist/index.js`) |
| `npm run dev` | Watch mode |
| `npm run link` | Symlink into Directus `extensions/` |
| `npm run validate` | Validate extension package |

## Project layout

```
src/
  index.ts                 # Interface registration
  interface.vue            # Multi-column grid
  translation-form.vue     # Per-language form column
  language-header.vue      # Language label + progress
  composables/             # Relation staging (from Directus core, adapted)
  utils/
```

## License

MIT — includes adapted logic from [Directus](https://github.com/directus/directus) (MIT).
